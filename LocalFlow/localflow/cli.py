"""Command line entry point: `localflow` or `python -m localflow`."""

from __future__ import annotations

import argparse
import json
import logging
import sys
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
        for noisy in ("faster_whisper", "urllib3", "httpx", "huggingface_hub"):
            logging.getLogger(noisy).setLevel(logging.WARNING)


def _apply_overrides(cfg: Config, args: argparse.Namespace) -> None:
    for name in ("model", "hotkey", "hotkey_mode", "output_mode", "device", "language"):
        value = getattr(args, name, None)
        if value is not None:
            setattr(cfg, name, value)
    if getattr(args, "llm", None) is not None:
        cfg.llm_cleanup = args.llm
    if getattr(args, "no_sounds", False):
        cfg.sounds = False


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

    p_hist = sub.add_parser("history", help="Show recent dictations")
    p_hist.add_argument("--limit", type=int, default=20)
    p_hist.set_defaults(func=cmd_history)

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    argv = list(sys.argv[1:] if argv is None else argv)
    commands = {"run", "init", "config", "devices", "test-mic", "transcribe", "history"}
    if not (set(argv) & (commands | {"-h", "--help", "--version"})):
        # Bare `localflow [--model small ...]` means `localflow run ...`.
        argv = ["run"] + argv
    args = parser.parse_args(argv)
    _setup_logging(args.verbose)
    if getattr(args, "language", None) == "auto":
        args.language = None
    return args.func(args)
