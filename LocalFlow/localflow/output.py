"""Deliver text to the focused window: type it, paste it, or just copy it."""

from __future__ import annotations

import logging
import platform
import time

log = logging.getLogger(__name__)


def copy_to_clipboard(text: str) -> None:
    import pyperclip

    pyperclip.copy(text)


def read_clipboard() -> str:
    try:
        import pyperclip

        return pyperclip.paste() or ""
    except Exception:
        return ""


def type_text(text: str, interval: float = 0.0) -> None:
    from pynput.keyboard import Controller, Key

    kb = Controller()
    # pynput's type() handles most Unicode, but newlines/tabs are more
    # reliable as real key presses in editors and chat boxes.
    for chunk in _split_keep(text, "\n\t"):
        if chunk == "\n":
            kb.press(Key.enter)
            kb.release(Key.enter)
        elif chunk == "\t":
            kb.press(Key.tab)
            kb.release(Key.tab)
        elif chunk:
            if interval > 0:
                for ch in chunk:
                    kb.type(ch)
                    time.sleep(interval)
            else:
                kb.type(chunk)


def paste_text(text: str, restore_clipboard: bool = True) -> None:
    from pynput.keyboard import Controller, Key

    previous = read_clipboard() if restore_clipboard else ""
    copy_to_clipboard(text)
    kb = Controller()
    modifier = Key.cmd if platform.system() == "Darwin" else Key.ctrl
    time.sleep(0.05)  # let the clipboard settle before the paste keystroke
    with kb.pressed(modifier):
        kb.press("v")
        kb.release("v")
    if restore_clipboard and previous:
        time.sleep(0.15)
        try:
            copy_to_clipboard(previous)
        except Exception:
            pass


def deliver(text: str, mode: str = "type", type_interval: float = 0.0) -> None:
    if not text:
        return
    if mode in ("type", "paste") and platform.system() == "Darwin":
        from .app import mac_trusted
        from .notify import notify

        if not mac_trusted():
            copy_to_clipboard(text)
            log.error("macOS Accessibility permission is missing for this app, so keystrokes "
                      "are silently dropped. Copied the text to the clipboard instead. Fix: "
                      "System Settings > Privacy & Security > Accessibility > add LocalFlow "
                      "(or your terminal), then quit and reopen it.")
            notify("LocalFlow: text copied, not typed",
                   "Grant Accessibility to LocalFlow in System Settings, then reopen it. "
                   "Press Cmd+V to paste this dictation.")
            return
    if mode == "type":
        type_text(text, interval=type_interval)
    elif mode == "paste":
        paste_text(text)
    elif mode == "clipboard":
        copy_to_clipboard(text)
    else:
        raise ValueError(f"Unknown output mode {mode!r}")


def _split_keep(text: str, separators: str) -> list[str]:
    out: list[str] = []
    buf = ""
    for ch in text:
        if ch in separators:
            if buf:
                out.append(buf)
                buf = ""
            out.append(ch)
        else:
            buf += ch
    if buf:
        out.append(buf)
    return out
