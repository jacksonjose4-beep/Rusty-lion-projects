"""App state machine with a fake recorder and pipeline: no mic, no model."""

import time

import numpy as np

from localflow.app import IDLE, OFF, PROCESSING, RECORDING, App, Pipeline
from localflow.config import Config


class FakeRecorder:
    def __init__(self):
        self.recording = False

    def start(self):
        self.recording = True

    def stop(self):
        self.recording = False
        return (0.1 * np.ones(16000)).astype(np.float32)


class FakePipeline:
    def __init__(self):
        self.calls = 0

    def process(self, audio):
        self.calls += 1
        return "hello "


def make_app(tmp_path, monkeypatch, **cfg):
    monkeypatch.setenv("LOCALFLOW_HOME", str(tmp_path))
    app = App(Config(sounds=False, **cfg), recorder=FakeRecorder(), pipeline=FakePipeline())
    app.state = IDLE
    states = []
    app.on_state = states.append
    return app, states


def wait_idle(app):
    for _ in range(100):
        if app.state in (IDLE, OFF):
            return
        time.sleep(0.01)
    raise AssertionError(f"still {app.state}")


def test_hold_mode_records_between_press_and_release(tmp_path, monkeypatch):
    app, states = make_app(tmp_path, monkeypatch)
    app._on_activate()
    assert app.recorder.recording and app.state == RECORDING
    app._on_deactivate()
    assert not app.recorder.recording
    wait_idle(app)
    assert app.pipeline.calls == 1
    assert states[:2] == [RECORDING, PROCESSING] and states[-1] == IDLE
    assert app.last_text == "hello"


def test_toggle_mode_uses_press_twice(tmp_path, monkeypatch):
    app, _ = make_app(tmp_path, monkeypatch, hotkey_mode="toggle")
    app._on_activate()
    app._on_deactivate()          # release must not stop in toggle mode
    assert app.recorder.recording
    app._on_activate()
    wait_idle(app)
    assert app.pipeline.calls == 1


def test_paused_app_ignores_hotkey_and_manual_start_still_works(tmp_path, monkeypatch):
    app, states = make_app(tmp_path, monkeypatch)
    app.set_enabled(False)
    assert app.state == OFF
    app._on_activate()
    assert not app.recorder.recording
    app.set_enabled(True)
    assert app.start_recording()
    assert app.stop_recording()
    wait_idle(app)
    assert app.pipeline.calls == 1


def test_pausing_mid_recording_discards_audio(tmp_path, monkeypatch):
    app, _ = make_app(tmp_path, monkeypatch)
    app.start_recording()
    app.set_enabled(False)
    assert not app.recorder.recording
    assert app.pipeline.calls == 0


def test_set_hotkey_validates_and_saves(tmp_path, monkeypatch):
    app, _ = make_app(tmp_path, monkeypatch)
    app.set_hotkey("<alt_r>", "toggle")
    saved = Config.load()
    assert saved.hotkey == "<alt_r>" and saved.hotkey_mode == "toggle"
    import pytest

    with pytest.raises(ValueError):
        app.set_hotkey("<nope>")
    with pytest.raises(ValueError):
        app.set_hotkey("<alt_r>", "sometimes")
    assert Config.load().hotkey == "<alt_r>"


def test_pipeline_is_real_class():
    assert Pipeline is not None
