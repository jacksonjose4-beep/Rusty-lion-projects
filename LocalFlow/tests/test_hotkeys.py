import pytest

from localflow.hotkeys import ComboTracker, key_name, parse_hotkey


def test_parse_named_and_char_keys():
    assert parse_hotkey("<ctrl>+<shift>+<space>") == ["ctrl", "shift", "space"]
    assert parse_hotkey("alt + Z") == ["alt", "z"]
    assert parse_hotkey("<cmd>+<f13>") == ["cmd", "f13"]
    assert parse_hotkey("option+space") == ["alt", "space"]


def test_parse_rejects_unknown():
    with pytest.raises(ValueError):
        parse_hotkey("<ctrl>+<banana>")
    with pytest.raises(ValueError):
        parse_hotkey("<ctrl>++z")


def test_combo_fires_once_on_full_press_and_once_on_release():
    t = ComboTracker(["ctrl", "shift", "space"])
    assert not t.press("ctrl_l")
    assert not t.press("shift")
    assert t.press("space")          # combo complete -> activate
    assert not t.press("space")      # key repeat must not re-fire
    assert t.release("space")        # broken -> deactivate
    assert not t.release("shift")    # already inactive
    assert not t.release("ctrl_l")


def test_modifier_family_matches_either_side():
    t = ComboTracker(["ctrl", "z"])
    assert not t.press("ctrl_r")
    assert t.press("z")
    assert t.release("ctrl_r")


def test_toggle_style_repeated_presses():
    t = ComboTracker(["alt", "z"])
    t.press("alt")
    assert t.press("z")
    t.release("z")
    assert t.press("z")  # alt still held, z pressed again -> fires again


class FakeKey:
    def __init__(self, name=None, char=None, vk=None):
        self.name = name
        self.char = char
        self.vk = vk


def test_key_name_normalisation():
    assert key_name(FakeKey(name="ctrl_l")) == "ctrl_l"
    assert key_name(FakeKey(char="Z")) == "z"
    assert key_name(FakeKey(vk=0x5A)) == "z"   # ctrl held, char is None on Windows
    assert key_name(FakeKey()) is None
