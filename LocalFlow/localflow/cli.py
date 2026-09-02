"""Command line entry point: `localflow` or `python -m localflow`."""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
import warnings
from dataclasses import asdict

from . import __version__
from .config import Config, config_path


def _setup_logging(verbose: bool) -> None:
    logging.basicConfig(
        level=logging.DEBUG if verbose else logging.INFO,
        format="%(asctime)s %(levelname)-7s %(message)s",
        datefmt="%H:%M:%S",
    )
    if not verbose:
        for noisy in ("faster_whisper", "urllib3", "httpx"):
            logging.getLogger(noisy).setLevel(logging.WARNING)
        # "You are sending unauthenticated requests to the HF Hub" is noise
        # during the one-time model download; there is no account to log into.
        logging.getLogger("huggingface_hub").setLevel(logging.ERROR)
        warnings.filterwarnings("ignore", message=".*unauthenticated requests.*")


def _apply_overrides(cfg: Config, args: argparse.Namespace) -> None:
    for name in ("model", "hotkey", "hotkey_mode", "output_mode", "device", "language"):
        value = getattr(args, name, None)
        if value is not None:
            setattr(cfg, name, value)
    if getattr(args, "llm", None) is not None:
        cfg.llm_cleanup = args.llm
    if getattr(args, "no_sounds", False):
        cfg.sounds = False
    if getattr(args, "no_tray", False):
        cfg.tray = False


def cmd_run(args: argparse.Namespace) -> int:
    from .app import App

    cfg = Config.load()
    _apply_overrides(cfg, args)
    problems = cfg.validate()
    if problems:
        for p in problems:
            print(f"config error: {p}", file=sys.stderr)
        return 2
    App(cfg).run()
    return 0


def cmd_init(args: argparse.Namespace) -> int:
    path = config_path()
    if path.exists() and not args.force:
        print(f"Config already exists at {path} (use --force to overwrite)")
        return 0
    cfg = Config()
    _apply_overrides(cfg, args)
    cfg.save(path)
    print(f"Wrote default config to {path}")
    return 0


def cmd_config(args: argparse.Namespace) -> int:
    cfg = Config.load()
    if args.set:
        for item in args.set:
            if "=" not in item:
                print(f"expected key=value, got {item!r}", file=sys.stderr)
                return 2
            key, _, raw = item.partition("=")
            key = key.strip()
            if not hasattr(cfg, key):
                print(f"unknown config key {key!r}", file=sys.stderr)
                return 2
            try:
                value = json.loads(raw)
            except json.JSONDecodeError:
                value = raw
            setattr(cfg, key, value)
        problems = cfg.validate()
        if problems:
            for p in problems:
                print(f"config error: {p}", file=sys.stderr)
            return 2
        cfg.save()
        print(f"Saved {config_path()}")
    print(json.dumps(asdict(cfg), indent=2))
    return 0


def cmd_devices(args: argparse.Namespace) -> int:
    from .audio import list_input_devices

    for dev in list_input_devices():
        print(f"[{dev['index']}] {dev['name']}")
    print("\nSet one with: localflow config --set input_device=<index>")
    return 0


def cmd_test_mic(args: argparse.Namespace) -> int:
    import time

    from .audio import Recorder, duration, rms_dbfs

    cfg = Config.load()
    rec = Recorder(cfg.sample_rate, cfg.input_device)
    print(f"Recording {args.seconds}s... say something.")
    rec.start()
    time.sleep(args.seconds)
    audio = rec.stop()
    print(f"Captured {duration(audio, cfg.sample_rate):.2f}s at {rms_dbfs(audio):.0f} dBFS "
          f"(speech is usually -35 to -10; below -50 means the mic is silent)")
    if args.transcribe:
        from .app import Pipeline

        pipe = Pipeline(cfg, deliver=lambda t: print(f"\n>>> {t}"))
        pipe.process(audio)
    return 0


def cmd_transcribe(args: argparse.Namespace) -> int:
    from .app import Pipeline
    from .transcriber import load_wav

    cfg = Config.load()
    _apply_overrides(cfg, args)
    cfg.history = False
    cfg.trailing_space = False
    audio, rate = load_wav(args.file)
    cfg.sample_rate = rate
    pipe = Pipeline(cfg, deliver=lambda t: print(t))
    text = pipe.process(audio)
    return 0 if text else 1


def _terminal_app_name() -> str:
    prog = os.environ.get("TERM_PROGRAM", "")
    names = {"Apple_Terminal": "Terminal", "iTerm.app": "iTerm", "vscode": "Visual Studio Code",
             "WarpTerminal": "Warp", "Hyper": "Hyper", "Alacritty": "Alacritty", "kitty": "kitty",
             "ghostty": "Ghostty"}
    return names.get(prog, prog or "your terminal app")


def cmd_doctor(args: argparse.Namespace) -> int:
    import platform
    import time

    from .app import mac_input_monitoring, mac_secure_input, mac_trusted
    from .hotkeys import ComboTracker, HotkeyListener, is_modifier, modifier_only, parse_hotkey

    cfg = Config.load()
    ok = True

    def report(label: str, good: bool | None, detail: str = "") -> None:
        nonlocal ok
        mark = "OK  " if good else ("??  " if good is None else "FAIL")
        if good is False:
            ok = False
        print(f"[{mark}] {label}" + (f": {detail}" if detail else ""))

    print(f"LocalFlow {__version__} on {platform.system()} {platform.release()}, "
          f"Python {platform.python_version()} ({sys.executable})")
    print(f"Config: {config_path()}")
    print(f"Hotkey: {cfg.hotkey} ({cfg.hotkey_mode}), output: {cfg.output_mode}, model: {cfg.model}")
    print()

    try:
        parse_hotkey(cfg.hotkey)
        report("Hotkey parses", True)
    except ValueError as exc:
        report("Hotkey parses", False, str(exc))

    if platform.system() == "Darwin":
        term = _terminal_app_name()
        trusted = mac_trusted()
        report("macOS Accessibility permission", trusted,
               "" if trusted else f"System Settings > Privacy & Security > Accessibility: add {term}, "
                                  "then quit and reopen it (Cmd+Q, not just close the window)")
        im = mac_input_monitoring()
        report("macOS Input Monitoring permission", im,
               "" if im else f"System Settings > Privacy & Security > Input Monitoring: add {term}. "
                             f"If it is already listed, also add {sys.executable} "
                             "(press Cmd+Shift+G in the file picker and paste that path)")
        holder = mac_secure_input()
        combo_mod_only = False
        try:
            combo_mod_only = modifier_only(parse_hotkey(cfg.hotkey))
        except ValueError:
            pass
        if holder and not combo_mod_only:
            report("macOS Secure Keyboard Entry", False,
                   f"ON, held by {holder}. Ordinary keys like Space are hidden from LocalFlow. "
                   "Turn it off (Terminal menu > Secure Keyboard Entry, or iTerm2 menu > "
                   "Secure Keyboard Entry) or switch to a modifier-only hotkey: "
                   "`localflow hotkey \"<alt_r>\"` (right Option, hold to talk)")
        elif holder:
            report("macOS Secure Keyboard Entry", True,
                   f"ON, held by {holder}, but your hotkey is modifier-only so it still works")
        else:
            report("macOS Secure Keyboard Entry", True, "off")

    # Microphone
    try:
        from .audio import Recorder, duration, rms_dbfs

        rec = Recorder(cfg.sample_rate, cfg.input_device)
        print("Recording 2 seconds from the microphone, say something...")
        rec.start()
        time.sleep(2.0)
        audio = rec.stop()
        level = rms_dbfs(audio)
        secs = duration(audio, cfg.sample_rate)
        if secs < 1.0:
            report("Microphone", False, f"only captured {secs:.1f}s; check `localflow devices`")
        elif level < -55:
            report("Microphone", False, f"{level:.0f} dBFS is silence. Wrong device, or macOS "
                                        "Microphone permission is off for "
                                        f"{_terminal_app_name() if platform.system() == 'Darwin' else 'this app'}")
        else:
            report("Microphone", True, f"{level:.0f} dBFS")
    except Exception as exc:
        report("Microphone", False, str(exc))

    # Model cache
    try:
        from huggingface_hub import scan_cache_dir  # type: ignore

        cached = [r.repo_id for r in scan_cache_dir().repos if "whisper" in r.repo_id.lower()]
        report("Whisper model cached", bool(cached) or None,
               ", ".join(cached) if cached else "not yet; first `localflow` run downloads it")
    except Exception:
        report("Whisper model cached", None, "could not inspect cache")

    # Keyboard: do events arrive at all, and does the combo fire?
    seconds = args.seconds
    print(f"\nKeyboard test for {seconds:.0f} seconds. Press and hold your hotkey ({cfg.hotkey}); "
          "press other keys too. Each event is printed as the app sees it.")
    seen: list[str] = []
    fired = {"on": 0, "off": 0}

    tracker = ComboTracker(parse_hotkey(cfg.hotkey))

    class EchoListener(HotkeyListener):
        def _on_press(self, key) -> None:  # noqa: ANN001
            name = self._name(key)
            seen.append(name or "?")
            print(f"  press   {name!r}")
            if tracker.press(name):
                fired["on"] += 1
                print("  >>> hotkey DOWN (recording would start)")

        def _on_release(self, key) -> None:  # noqa: ANN001
            name = self._name(key)
            print(f"  release {name!r}")
            if tracker.release(name):
                fired["off"] += 1
                print("  >>> hotkey UP (recording would stop)")

    try:
        listener = EchoListener(cfg.hotkey, lambda: None, lambda: None)
        listener.start()
        if not listener.alive:
            report("Keyboard listener thread", False,
                   "it exited immediately. On macOS this means the Accessibility / Input "
                   "Monitoring permission is missing for the app that launched it, or the "
                   "terminal was not quit and reopened after granting it")
        else:
            report("Keyboard listener thread", True)
            time.sleep(seconds)
        try:
            listener.stop()
        except Exception:
            pass  # a dead listener re-raises its own error on stop; already reported
    except Exception as exc:
        report("Keyboard listener thread", False, str(exc))
        seen = []
    if not seen:
        report("Keyboard events received", False,
               "no key events at all. On macOS this is always the Accessibility / Input "
               "Monitoring permission (and a terminal restart). On Linux Wayland, global "
               "hotkeys are blocked; use an X11 session")
    else:
        report("Keyboard events received", True, f"{len(seen)} events")
        only_modifiers_seen = all(is_modifier(k) for k in seen)
        combo = parse_hotkey(cfg.hotkey)
        if fired["on"]:
            report("Hotkey combo detected", True)
        elif only_modifiers_seen and not modifier_only(combo):
            report("Hotkey combo detected", False,
                   "only modifier keys got through; ordinary keys are being hidden (macOS Secure "
                   "Keyboard Entry, or a password field is focused). Use a modifier-only hotkey: "
                   "`localflow hotkey \"<alt_r>\"` for right Option, or "
                   "`localflow hotkey \"<ctrl>+<alt>\"`")
        else:
            report("Hotkey combo detected", False,
                   f"keys seen: {sorted(set(seen))}. Change the hotkey with `localflow hotkey` "
                   "or the menu bar icon")
    print()
    print("All checks passed. Run `localflow` and dictate." if ok
          else "Fix the FAIL lines above, then run `localflow doctor` again.")
    return 0 if ok else 1


def cmd_hotkey(args: argparse.Namespace) -> int:
    """Capture a key combo from the keyboard and save it as the hotkey."""
    import time

    from .hotkeys import HotkeyListener

    cfg = Config.load()
    if args.spec:
        from .hotkeys import parse_hotkey

        try:
            parse_hotkey(args.spec)
        except ValueError as exc:
            print(f"error: {exc}", file=sys.stderr)
            return 2
        cfg.hotkey = args.spec
        if args.mode:
            cfg.hotkey_mode = args.mode
        cfg.save()
        print(f"Hotkey set to {cfg.hotkey} ({cfg.hotkey_mode}). Restart localflow to use it.")
        return 0

    print("Press and hold the key combination you want, then release all keys. "
          "Esc cancels. Waiting...")
    held: set[str] = set()
    peak: list[set[str]] = []
    done = {"flag": False, "cancel": False}

    class Capture(HotkeyListener):
        def _on_press(self, key) -> None:  # noqa: ANN001
            name = self._name(key)
            if name == "esc":
                done["cancel"] = True
                return
            if name:
                held.add(name)

        def _on_release(self, key) -> None:  # noqa: ANN001
            name = self._name(key)
            if name in held:
                if not peak or len(held) >= len(peak[-1]):
                    peak.append(set(held))
                held.discard(name)
            if not held and peak:
                done["flag"] = True

    listener = Capture("<ctrl>", lambda: None, lambda: None)
    listener.start()
    while not (done["flag"] or done["cancel"]):
        time.sleep(0.05)
    listener.stop()
    if done["cancel"] or not peak:
        print("Cancelled.")
        return 1
    combo = peak[-1]
    order = ["ctrl", "ctrl_l", "ctrl_r", "alt", "alt_l", "alt_r", "alt_gr", "shift", "shift_l",
             "shift_r", "cmd", "cmd_l", "cmd_r"]
    keys = sorted(combo, key=lambda k: (order.index(k) if k in order else 99, k))
    spec = "+".join(k if len(k) == 1 else f"<{k}>" for k in keys)
    cfg.hotkey = spec
    if args.mode:
        cfg.hotkey_mode = args.mode
    cfg.save()
    print(f"Hotkey set to {spec} ({cfg.hotkey_mode}). Saved to {config_path()}.")
    print("Restart localflow, or pick it from the menu bar icon next time.")
    return 0


def cmd_history(args: argparse.Namespace) -> int:
    from .history import history_path, recent

    items = recent(args.limit)
    if not items:
        print(f"No history yet ({history_path()})")
        return 0
    for item in items:
        print(f"{item.get('ts', '')}  {item.get('text', '')}")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="localflow", description=__doc__)
    parser.add_argument("--version", action="version", version=f"localflow {__version__}")
    parser.add_argument("-v", "--verbose", action="store_true")
    sub = parser.add_subparsers(dest="command")

    def add_overrides(p: argparse.ArgumentParser) -> None:
        p.add_argument("--model", help="Whisper model: tiny, base, small, medium, large-v3, distil-large-v3")
        p.add_argument("--hotkey", help="e.g. '<ctrl>+<shift>+<space>' or '<alt>+z'")
        p.add_argument("--hotkey-mode", dest="hotkey_mode", choices=["hold", "toggle"])
        p.add_argument("--output-mode", dest="output_mode", choices=["type", "paste", "clipboard"])
        p.add_argument("--device", choices=["auto", "cpu", "cuda"])
        p.add_argument("--language", help="ISO code like en, or 'auto'")
        p.add_argument("--llm", dest="llm", action="store_true", default=None,
                       help="Polish with a local Ollama model after transcribing")
        p.add_argument("--no-sounds", dest="no_sounds", action="store_true")
        p.add_argument("--no-tray", dest="no_tray", action="store_true",
                       help="Run in the terminal only, without the menu bar icon")

    p_run = sub.add_parser("run", help="Start dictation (default command)")
    add_overrides(p_run)
    p_run.set_defaults(func=cmd_run)

    p_init = sub.add_parser("init", help="Write a default config file")
    add_overrides(p_init)
    p_init.add_argument("--force", action="store_true")
    p_init.set_defaults(func=cmd_init)

    p_cfg = sub.add_parser("config", help="Show or change settings")
    p_cfg.add_argument("--set", action="append", metavar="KEY=VALUE",
                       help='e.g. --set model=small --set replacements=\'{"gh":"GitHub"}\'')
    p_cfg.set_defaults(func=cmd_config)

    p_dev = sub.add_parser("devices", help="List microphones")
    p_dev.set_defaults(func=cmd_devices)

    p_mic = sub.add_parser("test-mic", help="Record a few seconds and report the level")
    p_mic.add_argument("--seconds", type=float, default=3.0)
    p_mic.add_argument("--transcribe", action="store_true", help="Also run it through Whisper")
    p_mic.set_defaults(func=cmd_test_mic)

    p_tr = sub.add_parser("transcribe", help="Transcribe a WAV file and print the cleaned text")
    p_tr.add_argument("file")
    add_overrides(p_tr)
    p_tr.set_defaults(func=cmd_transcribe)

    p_doc = sub.add_parser("doctor", help="Check permissions, microphone and hotkey")
    p_doc.add_argument("--seconds", type=float, default=8.0, help="Length of the keyboard test")
    p_doc.set_defaults(func=cmd_doctor)

    p_hk = sub.add_parser("hotkey", help="Set the dictation hotkey by pressing it")
    p_hk.add_argument("spec", nargs="?", help="Or give it directly, e.g. '<alt_r>' or '<ctrl>+<alt>+d'")
    p_hk.add_argument("--mode", choices=["hold", "toggle"])
    p_hk.set_defaults(func=cmd_hotkey)

    p_hist = sub.add_parser("history", help="Show recent dictations")
    p_hist.add_argument("--limit", type=int, default=20)
    p_hist.set_defaults(func=cmd_history)

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    argv = list(sys.argv[1:] if argv is None else argv)
    commands = {"run", "init", "config", "devices", "test-mic", "transcribe", "history", "doctor", "hotkey"}
    if not (set(argv) & (commands | {"-h", "--help", "--version"})):
        # Bare `localflow [--model small ...]` means `localflow run ...`.
        argv = ["run"] + argv
    args = parser.parse_args(argv)
    _setup_logging(args.verbose)
    if getattr(args, "language", None) == "auto":
        args.language = None
    return args.func(args)
