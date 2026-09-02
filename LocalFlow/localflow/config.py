"""User configuration, stored as JSON in ~/.localflow/config.json."""

from __future__ import annotations

import json
import os
from dataclasses import asdict, dataclass, field, fields
from pathlib import Path
from typing import Any


def config_dir() -> Path:
    override = os.environ.get("LOCALFLOW_HOME")
    return Path(override) if override else Path.home() / ".localflow"


def config_path() -> Path:
    return config_dir() / "config.json"


@dataclass
class Config:
    # Hotkey, pynput style. Push-to-talk: hold to record, release to stop.
    hotkey: str = "<ctrl>+<shift>+<space>"
    # "hold" (push to talk) or "toggle" (press once to start, again to stop).
    hotkey_mode: str = "hold"
    # Optional second hotkey that switches dictation on/off entirely.
    enable_hotkey: str | None = None
    # Show a menu bar / system tray icon with status and controls.
    tray: bool = True
    # Floating on-screen widget (mic / on-off / history). macOS for now.
    overlay: bool = True
    # Saved widget position [x, y]; set automatically when you drag it.
    overlay_position: list[float] | None = None

    # Whisper model: tiny, base, small, medium, large-v3, distil-large-v3, ...
    model: str = "base"
    # "auto", "cpu", or "cuda"
    device: str = "auto"
    # "auto", "int8", "float16", "float32"
    compute_type: str = "auto"
    # Language code such as "en". Leave None to auto-detect.
    language: str | None = "en"
    # Decoding beam size. 1 is fastest, 5 is more accurate.
    beam_size: int = 5
    # Whisper's own voice activity filter drops long silences before decoding.
    vad_filter: bool = True
    # Optional prompt biasing the decoder toward names and jargon you use.
    initial_prompt: str | None = None

    # Audio capture
    sample_rate: int = 16000
    input_device: str | int | None = None
    # Discard recordings shorter than this (accidental taps).
    min_recording_seconds: float = 0.3
    # Safety cap so a stuck key cannot record forever.
    max_recording_seconds: float = 120.0

    # Text cleanup
    remove_fillers: bool = True
    extra_fillers: list[str] = field(default_factory=list)
    voice_commands: bool = True
    capitalize_sentences: bool = True
    # Personal dictionary: spoken form -> written form, applied case-insensitively.
    replacements: dict[str, str] = field(default_factory=dict)

    # Optional polish with a local LLM through Ollama (still fully on-device).
    llm_cleanup: bool = False
    ollama_url: str = "http://127.0.0.1:11434"
    ollama_model: str = "llama3.2:3b"
    llm_timeout_seconds: float = 20.0

    # Output: "type" (simulate keystrokes), "paste" (clipboard + ctrl/cmd+v),
    # or "clipboard" (copy only, never touch the focused window).
    output_mode: str = "type"
    # Add a trailing space so consecutive dictations read naturally.
    trailing_space: bool = True
    # Seconds between simulated keystrokes in "type" mode. 0 is fastest;
    # raise it if an app drops characters.
    type_interval: float = 0.0

    # Play a short beep on start/stop so you know the mic state.
    sounds: bool = True
    # Keep a local history of transcripts at ~/.localflow/history.jsonl
    history: bool = True

    @classmethod
    def load(cls, path: Path | None = None) -> "Config":
        path = path or config_path()
        cfg = cls()
        if path.exists():
            with open(path, "r", encoding="utf-8") as fh:
                data = json.load(fh)
            cfg.apply(data)
        return cfg

    def apply(self, data: dict[str, Any]) -> None:
        known = {f.name for f in fields(self)}
        for key, value in data.items():
            if key in known:
                setattr(self, key, value)

    def save(self, path: Path | None = None) -> Path:
        path = path or config_path()
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w", encoding="utf-8") as fh:
            json.dump(asdict(self), fh, indent=2)
            fh.write("\n")
        return path

    def validate(self) -> list[str]:
        problems: list[str] = []
        if self.hotkey_mode not in ("hold", "toggle"):
            problems.append(f"hotkey_mode must be 'hold' or 'toggle', got {self.hotkey_mode!r}")
        if self.output_mode not in ("type", "paste", "clipboard"):
            problems.append(
                f"output_mode must be 'type', 'paste' or 'clipboard', got {self.output_mode!r}"
            )
        if self.device not in ("auto", "cpu", "cuda"):
            problems.append(f"device must be 'auto', 'cpu' or 'cuda', got {self.device!r}")
        if self.sample_rate <= 0:
            problems.append("sample_rate must be positive")
        if self.min_recording_seconds < 0:
            problems.append("min_recording_seconds must be >= 0")
        if self.max_recording_seconds <= self.min_recording_seconds:
            problems.append("max_recording_seconds must exceed min_recording_seconds")
        return problems
