"""The dictation loop: hotkey -> record -> transcribe -> clean -> type."""

from __future__ import annotations

import logging
import platform
import threading
import time
from typing import Callable

import numpy as np

from . import cleanup, history, output
from .audio import Recorder, beep, duration, rms_dbfs
from .config import Config
from .hotkeys import HotkeyListener, parse_hotkey
from .transcriber import Transcriber

log = logging.getLogger(__name__)

SILENCE_DBFS = -55.0

# States reported to the tray icon.
LOADING, IDLE, RECORDING, PROCESSING, OFF = "loading", "idle", "recording", "processing", "off"


class Pipeline:
    """Everything after audio capture. Kept separate so it can be tested
    with a fake transcriber and no microphone."""

    def __init__(self, cfg: Config, transcriber: Transcriber | None = None,
                 deliver: Callable[[str], None] | None = None) -> None:
        self.cfg = cfg
        self.transcriber = transcriber or Transcriber(
            model=cfg.model, device=cfg.device, compute_type=cfg.compute_type,
            language=cfg.language, beam_size=cfg.beam_size, vad_filter=cfg.vad_filter,
            initial_prompt=cfg.initial_prompt,
        )
        self.deliver = deliver or (
            lambda text: output.deliver(text, cfg.output_mode, cfg.type_interval)
        )

    def clean(self, raw: str) -> str:
        text = cleanup.clean_transcript(
            raw,
            remove_filler_words=self.cfg.remove_fillers,
            extra_fillers=self.cfg.extra_fillers,
            voice_commands=self.cfg.voice_commands,
            capitalize=self.cfg.capitalize_sentences,
            replacements=self.cfg.replacements,
        )
        if text and self.cfg.llm_cleanup:
            from . import llm

            text = llm.polish(text, self.cfg.ollama_url, self.cfg.ollama_model,
                              self.cfg.llm_timeout_seconds)
        return text

    def process(self, audio: np.ndarray) -> str:
        """Transcribe, clean, deliver. Returns the delivered text ("" if nothing)."""
        secs = duration(audio, self.cfg.sample_rate)
        if secs < self.cfg.min_recording_seconds:
            log.info("Ignored %.2fs recording (below min_recording_seconds)", secs)
            return ""
        level = rms_dbfs(audio)
        if level < SILENCE_DBFS:
            log.info("Ignored %.1fs of silence (%.0f dBFS). Is the right microphone selected?",
                     secs, level)
            return ""

        result = self.transcriber.transcribe(audio, self.cfg.sample_rate)
        text = self.clean(result.text)
        log.info("%.1fs audio -> %.1fs processing | raw=%r", secs, result.processing_seconds, result.text)
        if not text:
            log.info("Nothing to type.")
            return ""
        if self.cfg.trailing_space and not text.endswith("\n"):
            text += " "
        self.deliver(text)
        if self.cfg.history:
            try:
                history.append(result.text, text.rstrip(), secs, result.processing_seconds)
            except OSError as exc:
                log.warning("Could not write history: %s", exc)
        log.info("Typed: %s", text.strip())
        return text


class App:
    def __init__(self, cfg: Config, recorder: Recorder | None = None,
                 pipeline: Pipeline | None = None) -> None:
        self.cfg = cfg
        self.pipeline = pipeline or Pipeline(cfg)
        self.recorder = recorder or Recorder(sample_rate=cfg.sample_rate, device=cfg.input_device,
                                             max_seconds=cfg.max_recording_seconds)
        self.enabled = True
        self.state = LOADING
        self.last_text = ""
        self.on_state: Callable[[str], None] | None = None
        self._busy = threading.Lock()
        self._stop = threading.Event()
        self._watchdog: threading.Timer | None = None
        self._listener: HotkeyListener | None = None
        self._enable_listener: HotkeyListener | None = None

    # State ---------------------------------------------------------------

    def _set_state(self, state: str) -> None:
        self.state = state
        if self.on_state is not None:
            try:
                self.on_state(state)
            except Exception:
                log.debug("on_state callback failed", exc_info=True)

    def set_enabled(self, enabled: bool) -> None:
        self.enabled = enabled
        if not enabled and self.recorder.recording:
            self._cancel_recording()
        log.info("Dictation %s", "enabled" if enabled else "paused")
        if self.state in (IDLE, OFF):
            self._set_state(IDLE if enabled else OFF)

    def toggle_enabled(self) -> None:
        self.set_enabled(not self.enabled)

    # Hotkey callbacks ---------------------------------------------------

    def _on_activate(self) -> None:
        if not self.enabled:
            log.info("Hotkey pressed but dictation is paused")
            return
        if self.cfg.hotkey_mode == "toggle":
            if self.recorder.recording:
                self.stop_recording()
            else:
                self.start_recording()
        else:
            self.start_recording()

    def _on_deactivate(self) -> None:
        if self.cfg.hotkey_mode == "hold" and self.recorder.recording:
            self.stop_recording()

    def set_hotkey(self, spec: str, mode: str | None = None, save: bool = True) -> None:
        """Swap the dictation hotkey live. Validates before touching anything."""
        parse_hotkey(spec)
        if mode is not None and mode not in ("hold", "toggle"):
            raise ValueError(f"mode must be 'hold' or 'toggle', got {mode!r}")
        self.cfg.hotkey = spec
        if mode is not None:
            self.cfg.hotkey_mode = mode
        if self._listener is not None:
            self._listener.stop()
            self._listener = HotkeyListener(spec, self._on_activate, self._on_deactivate)
            self._listener.start()
        if save:
            self.cfg.save()
        log.info("Hotkey is now %s (%s)", spec, self.cfg.hotkey_mode)

    def set_output_mode(self, mode: str, save: bool = True) -> None:
        if mode not in ("type", "paste", "clipboard"):
            raise ValueError(mode)
        self.cfg.output_mode = mode
        if save:
            self.cfg.save()
        log.info("Output mode is now %s", mode)

    # Recording lifecycle -------------------------------------------------

    def start_recording(self) -> bool:
        """Begin capturing. Also used by the tray's manual Start button."""
        if self.recorder.recording:
            return False
        if self._busy.locked():
            log.info("Still processing the previous dictation; ignoring")
            return False
        try:
            self.recorder.start()
        except Exception as exc:
            log.error("Could not open microphone: %s", exc)
            return False
        if self.cfg.sounds:
            beep(880.0)
        self._set_state(RECORDING)
        log.info("Recording... (release to stop)" if self.cfg.hotkey_mode == "hold"
                 else "Recording... (press hotkey again to stop)")
        self._watchdog = threading.Timer(self.cfg.max_recording_seconds, self._on_watchdog)
        self._watchdog.daemon = True
        self._watchdog.start()
        return True

    def _on_watchdog(self) -> None:
        if self.recorder.recording:
            log.warning("Hit max_recording_seconds; stopping automatically")
            self.stop_recording()

    def _cancel_watchdog(self) -> None:
        if self._watchdog is not None:
            self._watchdog.cancel()
            self._watchdog = None

    def _cancel_recording(self) -> None:
        self._cancel_watchdog()
        self.recorder.stop()
        self._set_state(IDLE if self.enabled else OFF)

    def stop_recording(self) -> bool:
        """Stop capturing and transcribe in the background."""
        if not self.recorder.recording:
            return False
        self._cancel_watchdog()
        audio = self.recorder.stop()
        if self.cfg.sounds:
            beep(660.0)
        self._set_state(PROCESSING)
        worker = threading.Thread(target=self._process, args=(audio,), daemon=True)
        worker.start()
        return True

    def _process(self, audio: np.ndarray) -> None:
        with self._busy:
            try:
                self.last_text = self.pipeline.process(audio).strip()
            except Exception:
                log.exception("Dictation failed")
            finally:
                self._set_state(IDLE if self.enabled else OFF)

    # Main loop ------------------------------------------------------------

    def start(self) -> None:
        """Load the model and register hotkeys. Returns once ready."""
        self._set_state(LOADING)
        log.info("Loading model (first run downloads it, later runs are instant)...")
        self.pipeline.transcriber.load()
        self._listener = HotkeyListener(self.cfg.hotkey, self._on_activate, self._on_deactivate)
        self._listener.start()
        if self.cfg.enable_hotkey:
            self._enable_listener = HotkeyListener(self.cfg.enable_hotkey, self.toggle_enabled,
                                                   lambda: None)
            self._enable_listener.start()
        if not self._listener.alive:
            log.error("The keyboard listener stopped immediately, so the hotkey will NOT work. "
                      "%s Run `localflow doctor` for the exact steps. The menu bar icon's "
                      "Start/Stop recording still works meanwhile.",
                      "macOS has not granted this app Accessibility / Input Monitoring access."
                      if platform.system() == "Darwin" else "")
        elif platform.system() == "Darwin" and not mac_trusted():
            log.warning("macOS reports this app is not an Accessibility client; if the hotkey "
                        "does nothing, run `localflow doctor`.")
        mode = "Hold" if self.cfg.hotkey_mode == "hold" else "Press"
        log.info("Ready. %s %s to dictate. Output mode: %s. Ctrl+C to quit.",
                 mode, self.cfg.hotkey, self.cfg.output_mode)
        self._set_state(IDLE)

    def wait(self) -> None:
        try:
            while not self._stop.is_set():
                time.sleep(0.25)
        except KeyboardInterrupt:
            pass

    def shutdown(self) -> None:
        self._stop.set()
        for listener in (self._listener, self._enable_listener):
            if listener is not None:
                listener.stop()
        if self.recorder.recording:
            self.recorder.stop()
        log.info("Bye.")

    def run(self) -> None:
        """Console mode, or tray mode if configured and available."""
        if self.cfg.tray:
            try:
                from . import tray
            except Exception as exc:  # pystray/Pillow missing, no display, ...
                log.warning("Tray icon unavailable (%s); running in the terminal only", exc)
            else:
                tray.run(self)
                return
        self.start()
        try:
            self.wait()
        finally:
            self.shutdown()

    def stop(self) -> None:
        self._stop.set()


def mac_trusted() -> bool:
    """True if macOS lists this process as an Accessibility client."""
    try:
        import ctypes

        lib = ctypes.cdll.LoadLibrary(
            "/System/Library/Frameworks/ApplicationServices.framework/ApplicationServices"
        )
        lib.AXIsProcessTrusted.restype = ctypes.c_bool
        return bool(lib.AXIsProcessTrusted())
    except Exception:
        return True  # cannot tell; do not nag


def mac_input_monitoring() -> bool | None:
    """True/False for Input Monitoring, None if the check is unavailable."""
    try:
        import ctypes

        lib = ctypes.cdll.LoadLibrary(
            "/System/Library/Frameworks/CoreGraphics.framework/CoreGraphics"
        )
        fn = lib.CGPreflightListenEventAccess
        fn.restype = ctypes.c_bool
        return bool(fn())
    except Exception:
        return None
