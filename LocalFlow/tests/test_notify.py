from localflow.app import _pretty_hotkey
from localflow.notify import notify


def test_pretty_hotkey():
    assert _pretty_hotkey("<ctrl>+<shift>") == "Control + Shift"
    assert _pretty_hotkey("<alt_r>") == "right Option"
    assert _pretty_hotkey("<alt>+z") == "Option + Z"


def test_notify_never_raises():
    notify("t", 'm "quoted" \\ back')
