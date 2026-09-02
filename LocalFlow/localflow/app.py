"""The dictation loop: hotkey -> record -> transcribe -> clean -> type."""

from __future__ import annotations

import logging
import threading
import time
from typing import Callable

import numpy as np

from . import cleanup, history, output
from .audio import Recorder, beep, duration, rms_dbfs
from .config import Config
from .hotkeys import HotkeyListener
from .transcriber import Transcriber

log = logging.getLogger(__name__)

SILENCE_DBFS = -55.0


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
            log.info("Ignored %.1fs of silence (%.0f dBFS)", secs, level)
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
    def __init__(self, cfg: Config) -> None:
        self.cfg = cfg
        self.pipeline = Pipeline(cfg)
        self.recorder = Recorder(sample_rate=cfg.sample_rate, device=cfg.input_device,
                                 max_seconds=cfg.max_recording_seconds)
        self._busy = threading.Lock()
        self._stop = threading.Event()
        self._watchdog: threading.Timer | None = None

    # Hotkey callbacks ---------------------------------------------------

    def _on_activate(self) -> None:
        if self.cfg.hotkey_mode == "toggle":
            if self.recorder.recording:
                self._stop_and_process()
            else:
                self._start()
        else:
            self._start()

    def _on_deactivate(self) -> None:
        if self.cfg.hotkey_mode == "hold" and self.recorder.recording:
            self._stop_and_process()

    # Recording lifecycle -------------------------------------------------

    def _start(self) -> None:
        if self.recorder.recording:
            return
        if self._busy.locked():
            log.info("Still processing the previous dictation; ignoring hotkey")
            return
        try:
            self.recorder.start()
        except Exception as exc:
            log.error("Could not open microphone: %s", exc)
            return
        if self.cfg.sounds:
            beep(880.0)
        log.info("Recording... (release to stop)" if self.cfg.hotkey_mode == "hold"
                 else "Recording... (press hotkey again to stop)")
        self._watchdog = threading.Timer(self.cfg.max_recording_seconds, self._on_watchdog)
        self._watchdog.daemon = True
        self._watchdog.start()

    def _on_watchdog(self) -> None:
        if self.recorder.recording:
            log.warning("Hit max_recording_seconds; stopping automatically")
            self._stop_and_process()

    def _stop_and_process(self) -> None:
        if self._watchdog is not None:
            self._watchdog.cancel()
            self._watchdog = None
        audio = self.recorder.stop()
        if self.cfg.sounds:
            beep(660.0)
        worker = threading.Thread(target=self._process, args=(audio,), daemon=True)
        worker.start()

    def _process(self, audio: np.ndarray) -> None:
        with self._busy:
            try:
                self.pipeline.process(audio)
            except Exception:
                log.exception("Dictation failed")

    # Main loop ------------------------------------------------------------

    def run(self) -> None:
        log.info("Loading model (first run downloads it, later runs are instant)...")
        self.pipeline.transcriber.load()
        listener = HotkeyListener(self.cfg.hotkey, self._on_activate, self._on_deactivate)
        listener.start()
        mode = "hold" if self.cfg.hotkey_mode == "hold" else "press to start, press again to stop"
        log.info("Ready. %s %s to dictate. Output mode: %s. Ctrl+C to quit.",
                 mode.capitalize(), self.cfg.hotkey, self.cfg.output_mode)
        try:
            while not self._stop.is_set():
                time.sleep(0.25)
        except KeyboardInterrupt:
            pass
        finally:
            listener.stop()
            if self.recorder.recording:
                self.recorder.stop()
            log.info("Bye.")

    def stop(self) -> None:
        self._stop.set()
