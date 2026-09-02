"""Pipeline tests with a fake transcriber: no mic, no model download."""

import numpy as np

from localflow.app import Pipeline
from localflow.config import Config
from localflow.transcriber import Transcript, _resample


class FakeTranscriber:
    def __init__(self, text):
        self.text = text
        self.calls = 0

    def load(self):
        pass

    def transcribe(self, audio, sample_rate=16000):
        self.calls += 1
        return Transcript(self.text, "en", 0.99, len(audio) / sample_rate, 0.01)


def speech_like(seconds=1.0, rate=16000):
    rng = np.random.default_rng(0)
    return (0.1 * rng.standard_normal(int(seconds * rate))).astype(np.float32)


def make_pipeline(text, tmp_path, monkeypatch, **cfg_overrides):
    monkeypatch.setenv("LOCALFLOW_HOME", str(tmp_path))
    cfg = Config(**cfg_overrides)
    delivered = []
    pipe = Pipeline(cfg, transcriber=FakeTranscriber(text), deliver=delivered.append)
    return pipe, delivered


def test_happy_path_types_cleaned_text(tmp_path, monkeypatch):
    pipe, delivered = make_pipeline("um, hello world period", tmp_path, monkeypatch)
    out = pipe.process(speech_like())
    assert out == "Hello world. "
    assert delivered == ["Hello world. "]
    assert (tmp_path / "history.jsonl").exists()


def test_too_short_recording_is_dropped(tmp_path, monkeypatch):
    pipe, delivered = make_pipeline("hello", tmp_path, monkeypatch)
    assert pipe.process(speech_like(0.1)) == ""
    assert delivered == []
    assert pipe.transcriber.calls == 0


def test_silence_is_not_sent_to_whisper(tmp_path, monkeypatch):
    pipe, delivered = make_pipeline("thank you", tmp_path, monkeypatch)
    assert pipe.process(np.zeros(16000, dtype=np.float32)) == ""
    assert pipe.transcriber.calls == 0


def test_hallucination_is_not_typed(tmp_path, monkeypatch):
    pipe, delivered = make_pipeline("Thanks for watching!", tmp_path, monkeypatch)
    assert pipe.process(speech_like()) == ""
    assert delivered == []


def test_no_trailing_space_after_newline(tmp_path, monkeypatch):
    pipe, delivered = make_pipeline("hello new line", tmp_path, monkeypatch)
    assert pipe.process(speech_like()) == "Hello\n"


def test_history_can_be_disabled(tmp_path, monkeypatch):
    pipe, _ = make_pipeline("hello", tmp_path, monkeypatch, history=False)
    pipe.process(speech_like())
    assert not (tmp_path / "history.jsonl").exists()


def test_resample_changes_length():
    audio = np.zeros(44100, dtype=np.float32)
    assert len(_resample(audio, 44100, 16000)) == 16000
