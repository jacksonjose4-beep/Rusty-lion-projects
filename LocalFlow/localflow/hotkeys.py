"""Global hotkey handling with press *and* release events.

pynput's GlobalHotKeys only fires on press, which is no good for
push-to-talk, so this tracks the currently held keys itself.
"""

from __future__ import annotations

import threading
from typing import Callable

# Aliases people are likely to type in config.json -> pynput names.
ALIASES = {
    "ctrl": "ctrl", "control": "ctrl", "ctrl_l": "ctrl_l", "ctrl_r": "ctrl_r",
    "alt": "alt", "option": "alt", "opt": "alt", "alt_l": "alt_l", "alt_r": "alt_r", "alt_gr": "alt_gr",
    "shift": "shift", "shift_l": "shift_l", "shift_r": "shift_r",
    "cmd": "cmd", "command": "cmd", "super": "cmd", "win": "cmd", "meta": "cmd",
    "cmd_l": "cmd_l", "cmd_r": "cmd_r",
    "space": "space", "spacebar": "space", "tab": "tab", "enter": "enter", "return": "enter",
    "esc": "esc", "escape": "esc", "caps_lock": "caps_lock", "capslock": "caps_lock",
    "backspace": "backspace", "delete": "delete", "insert": "insert", "home": "home", "end": "end",
    "page_up": "page_up", "page_down": "page_down", "up": "up", "down": "down", "left": "left", "right": "right",
    "scroll_lock": "scroll_lock", "pause": "pause", "menu": "menu",
}
# Modifier "families": a config saying <ctrl> should match either physical ctrl key.
FAMILIES = {
    "ctrl": {"ctrl", "ctrl_l", "ctrl_r"},
    "alt": {"alt", "alt_l", "alt_r", "alt_gr"},
    "shift": {"shift", "shift_l", "shift_r"},
    "cmd": {"cmd", "cmd_l", "cmd_r"},
}
for _n in range(1, 21):  # pynput defines f1..f20
    ALIASES[f"f{_n}"] = f"f{_n}"


def parse_hotkey(spec: str) -> list[str]:
    """'<ctrl>+<shift>+<space>' -> ['ctrl', 'shift', 'space'].

    Single characters are returned as themselves ('z'). Named keys may be
    written with or without angle brackets.
    """
    parts = [p.strip() for p in spec.split("+")]
    keys: list[str] = []
    for part in parts:
        if not part:
            raise ValueError(f"Empty key in hotkey {spec!r}")
        name = part[1:-1] if part.startswith("<") and part.endswith(">") else part
        name = name.strip().lower()
        if len(name) == 1:
            keys.append(name)
        elif name in ALIASES:
            keys.append(ALIASES[name])
        else:
            raise ValueError(f"Unknown key {part!r} in hotkey {spec!r}")
    if not keys:
        raise ValueError("Hotkey is empty")
    return keys


def key_name(key) -> str | None:  # noqa: ANN001
    """Normalise a pynput key object to the names produced by parse_hotkey."""
    name = getattr(key, "name", None)
    if name:
        return name
    char = getattr(key, "char", None)
    if char:
        return char.lower()
    vk = getattr(key, "vk", None)
    if vk is not None and 0x30 <= vk <= 0x5A:  # 0-9, A-Z with a modifier held
        return chr(vk).lower()
    return None


class ComboTracker:
    """Pure logic, testable without pynput: are all keys of the combo down?"""

    def __init__(self, combo: list[str]) -> None:
        self.combo = combo
        self.held: set[str] = set()
        self.active = False

    def _satisfied(self) -> bool:
        for wanted in self.combo:
            family = FAMILIES.get(wanted, {wanted})
            if not (family & self.held):
                return False
        return True

    def press(self, name: str | None) -> bool:
        """Returns True the moment the combo becomes fully held."""
        if name is None:
            return False
        self.held.add(name)
        if not self.active and self._satisfied():
            self.active = True
            return True
        return False

    def release(self, name: str | None) -> bool:
        """Returns True the moment a held combo is broken."""
        if name is None:
            return False
        self.held.discard(name)
        if self.active and not self._satisfied():
            self.active = False
            return True
        return False

    def clear(self) -> None:
        self.held.clear()
        self.active = False


class HotkeyListener:
    def __init__(self, spec: str, on_activate: Callable[[], None],
                 on_deactivate: Callable[[], None]) -> None:
        self.tracker = ComboTracker(parse_hotkey(spec))
        self.on_activate = on_activate
        self.on_deactivate = on_deactivate
        self._listener = None
        self._lock = threading.Lock()

    def _on_press(self, key) -> None:  # noqa: ANN001
        with self._lock:
            fire = self.tracker.press(key_name(key))
        if fire:
            self.on_activate()

    def _on_release(self, key) -> None:  # noqa: ANN001
        with self._lock:
            fire = self.tracker.release(key_name(key))
        if fire:
            self.on_deactivate()

    def start(self) -> None:
        from pynput import keyboard

        self._listener = keyboard.Listener(on_press=self._on_press, on_release=self._on_release)
        self._listener.daemon = True
        self._listener.start()

    def stop(self) -> None:
        if self._listener is not None:
            self._listener.stop()
            self._listener = None

    def join(self) -> None:
        if self._listener is not None:
            self._listener.join()
