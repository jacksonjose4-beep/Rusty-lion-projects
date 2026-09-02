"""On-device speech to text with faster-whisper (CTranslate2 Whisper)."""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from typing import Any

import numpy as np

log = logging.getLogger(__name__)


@dataclass
class Transcript:
    text: str
    language: str | None
    language_probability: float | None
    audio_seconds: float
    processing_seconds: float


class Transcriber:
    def __init__(self, model: str = "base", device: str = "auto", compute_type: str = "auto",
                 language: str | None = "en", beam_size: int = 5, vad_filter: bool = True,
                 initial_prompt: str | None = None) -> None:
        self.model_name = model
        self.device = device
        self.compute_type = compute_type
        self.language = language
        self.beam_size = beam_size
        self.vad_filter = vad_filter
        self.initial_prompt = initial_prompt
        self._model: Any = None

    def load(self) -> None:
        if self._model is not None:
            return
        from faster_whisper import WhisperModel

        started = time.monotonic()
        log.info("Loading Whisper model %r (device=%s, compute=%s)...",
                 self.model_name, self.device, self.compute_type)
        self._model = WhisperModel(self.model_name, device=self.device, compute_type=self.compute_type)
        log.info("Model ready in %.1fs", time.monotonic() - started)

    def transcribe(self, audio: np.ndarray, sample_rate: int = 16000) -> Transcript:
        self.load()
        if sample_rate != 16000:
            audio = _resample(audio, sample_rate, 16000)
        audio_seconds = len(audio) / 16000.0
        started = time.monotonic()
        segments, info = self._model.transcribe(
            audio,
            language=self.language,
            beam_size=self.beam_size,
            vad_filter=self.vad_filter,
            initial_prompt=self.initial_prompt,
            condition_on_previous_text=False,
        )
        text = " ".join(seg.text.strip() for seg in segments if seg.text.strip())
        return Transcript(
            text=text,
            language=getattr(info, "language", None),
            language_probability=getattr(info, "language_probability", None),
            audio_seconds=audio_seconds,
            processing_seconds=time.monotonic() - started,
        )


def _resample(audio: np.ndarray, src_rate: int, dst_rate: int) -> np.ndarray:
    if src_rate == dst_rate or len(audio) == 0:
        return audio.astype(np.float32)
    n_out = int(round(len(audio) * dst_rate / src_rate))
    x_old = np.linspace(0.0, 1.0, len(audio), endpoint=False)
    x_new = np.linspace(0.0, 1.0, n_out, endpoint=False)
    return np.interp(x_new, x_old, audio).astype(np.float32)


def load_wav(path: str) -> tuple[np.ndarray, int]:
    """Read a PCM WAV file into float32 mono. Handy for `localflow transcribe`."""
    import wave

    with wave.open(path, "rb") as wf:
        rate = wf.getframerate()
        channels = wf.getnchannels()
        width = wf.getsampwidth()
        frames = wf.readframes(wf.getnframes())
    if width == 2:
        data = np.frombuffer(frames, dtype=np.int16).astype(np.float32) / 32768.0
    elif width == 4:
        data = np.frombuffer(frames, dtype=np.int32).astype(np.float32) / 2147483648.0
    elif width == 1:
        data = (np.frombuffer(frames, dtype=np.uint8).astype(np.float32) - 128.0) / 128.0
    else:
        raise ValueError(f"Unsupported WAV sample width: {width}")
    if channels > 1:
        data = data.reshape(-1, channels).mean(axis=1)
    return data, rate
