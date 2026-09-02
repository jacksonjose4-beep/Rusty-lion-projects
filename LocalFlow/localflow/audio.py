"""Microphone capture. Records 16 kHz mono float32, the format Whisper wants."""

from __future__ import annotations

import math
import threading
import time
from typing import Any

import numpy as np


class Recorder:
    def __init__(self, sample_rate: int = 16000, device: str | int | None = None,
                 max_seconds: float = 120.0) -> None:
        self.sample_rate = sample_rate
        self.device = device
        self.max_seconds = max_seconds
        self._chunks: list[np.ndarray] = []
        self._lock = threading.Lock()
        self._stream: Any = None
        self._started_at: float | None = None

    @property
    def recording(self) -> bool:
        return self._stream is not None

    def elapsed(self) -> float:
        return 0.0 if self._started_at is None else time.monotonic() - self._started_at

    def start(self) -> None:
        if self._stream is not None:
            return
        import sounddevice as sd  # imported lazily so tests run without PortAudio

        with self._lock:
            self._chunks = []

        def callback(indata, frames, time_info, status):  # noqa: ANN001
            if status:
                # Overflow etc. Keep going; a dropped frame beats a crash.
                pass
            with self._lock:
                self._chunks.append(indata[:, 0].copy())

        self._stream = sd.InputStream(
            samplerate=self.sample_rate,
            channels=1,
            dtype="float32",
            device=self.device,
            callback=callback,
            blocksize=0,
        )
        self._stream.start()
        self._started_at = time.monotonic()

    def stop(self) -> np.ndarray:
        stream, self._stream = self._stream, None
        self._started_at = None
        if stream is None:
            return np.zeros(0, dtype=np.float32)
        stream.stop()
        stream.close()
        with self._lock:
            chunks, self._chunks = self._chunks, []
        if not chunks:
            return np.zeros(0, dtype=np.float32)
        audio = np.concatenate(chunks).astype(np.float32)
        limit = int(self.max_seconds * self.sample_rate)
        return audio[:limit]


def duration(audio: np.ndarray, sample_rate: int) -> float:
    return float(len(audio)) / float(sample_rate) if sample_rate else 0.0


def rms_dbfs(audio: np.ndarray) -> float:
    """Loudness in dBFS. Roughly: below -50 is silence, speech is -35 to -10."""
    if len(audio) == 0:
        return -math.inf
    rms = float(np.sqrt(np.mean(np.square(audio.astype(np.float64)))))
    return -math.inf if rms == 0 else 20.0 * math.log10(rms)


def list_input_devices() -> list[dict[str, Any]]:
    import sounddevice as sd

    devices = []
    for idx, dev in enumerate(sd.query_devices()):
        if dev.get("max_input_channels", 0) > 0:
            devices.append({"index": idx, "name": dev["name"],
                            "default_samplerate": dev.get("default_samplerate")})
    return devices


def beep(frequency: float = 880.0, seconds: float = 0.08, volume: float = 0.2) -> None:
    """Short tone so you can hear when recording starts and stops."""
    try:
        import sounddevice as sd

        rate = 44100
        t = np.linspace(0, seconds, int(rate * seconds), endpoint=False)
        tone = (volume * np.sin(2 * np.pi * frequency * t)).astype(np.float32)
        fade = np.linspace(1, 0, len(tone)).astype(np.float32)
        sd.play(tone * fade, rate, blocking=False)
    except Exception:
        pass
