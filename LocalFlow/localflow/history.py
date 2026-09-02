"""Append-only local log of dictations, at ~/.localflow/history.jsonl."""

from __future__ import annotations

import json
import time
from pathlib import Path

from .config import config_dir


def history_path() -> Path:
    return config_dir() / "history.jsonl"


def append(raw: str, cleaned: str, audio_seconds: float, processing_seconds: float) -> None:
    path = history_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    record = {
        "ts": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "raw": raw,
        "text": cleaned,
        "audio_seconds": round(audio_seconds, 2),
        "processing_seconds": round(processing_seconds, 2),
    }
    with open(path, "a", encoding="utf-8") as fh:
        fh.write(json.dumps(record, ensure_ascii=False) + "\n")


def recent(limit: int = 20) -> list[dict]:
    path = history_path()
    if not path.exists():
        return []
    lines = path.read_text(encoding="utf-8").splitlines()
    out = []
    for line in lines[-limit:]:
        try:
            out.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return out
