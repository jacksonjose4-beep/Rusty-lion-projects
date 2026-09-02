"""Menu bar / system tray icon: shows state, toggles on/off, changes hotkeys.

Built on pystray so the same code works on macOS, Windows and X11 Linux.
The icon must run on the main thread (macOS insists), so the App itself is
started in a background thread from here.
"""

from __future__ import annotations

import logging
import subprocess
import sys
import webbrowser

from PIL import Image, ImageDraw

from .config import config_path
from .history import history_path

log = logging.getLogger(__name__)

HOTKEY_PRESETS = [
    ("Right Alt / Option (hold)", "<alt_r>"),
    ("Right Cmd / Win (hold)", "<cmd_r>"),
    ("Right Ctrl (hold)", "<ctrl_r>"),
    ("Ctrl + Shift (hold both)", "<ctrl>+<shift>"),
    ("Ctrl + Alt/Option (hold both)", "<ctrl>+<alt>"),
    ("Ctrl + Shift + Space", "<ctrl>+<shift>+<space>"),
    ("Ctrl + Alt/Option + Space", "<ctrl>+<alt>+<space>"),
    ("F13", "<f13>"),
    ("Alt/Option + Z", "<alt>+z"),
]

COLORS = {
    "loading": (150, 150, 150),
    "idle": (70, 160, 255),
    "recording": (235, 60, 60),
    "processing": (245, 170, 40),
    "off": (110, 110, 110),
}


def make_icon(state: str, size: int = 64) -> Image.Image:
    """A microphone glyph on a coloured disc. Red = recording."""
    color = COLORS.get(state, COLORS["idle"])
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse((2, 2, size - 2, size - 2), fill=color + (255,))
    white = (255, 255, 255, 255)
    cx = size / 2
    # capsule
    d.rounded_rectangle((cx - size * 0.12, size * 0.2, cx + size * 0.12, size * 0.55),
                        radius=int(size * 0.12), fill=white)
    # cradle
    d.arc((cx - size * 0.22, size * 0.3, cx + size * 0.22, size * 0.68),
          start=0, end=180, fill=white, width=max(2, size // 16))
    # stem + base
    d.line((cx, size * 0.68, cx, size * 0.8), fill=white, width=max(2, size // 16))
    d.line((cx - size * 0.14, size * 0.8, cx + size * 0.14, size * 0.8),
           fill=white, width=max(2, size // 16))
    if state == "off":
        d.line((size * 0.22, size * 0.78, size * 0.78, size * 0.22), fill=white, width=max(3, size // 12))
    return img


STATUS_TEXT = {
    "loading": "Loading model...",
    "idle": "Ready",
    "recording": "Recording... (release / press again to stop)",
    "processing": "Transcribing...",
    "off": "Paused",
}


def _open_path(path) -> None:  # noqa: ANN001
    path = str(path)
    try:
        if sys.platform == "darwin":
            subprocess.Popen(["open", path])
        elif sys.platform.startswith("win"):
            import os

            os.startfile(path)  # type: ignore[attr-defined]
        else:
            subprocess.Popen(["xdg-open", path])
    except Exception:
        webbrowser.open("file://" + path)


def run(app) -> None:  # noqa: ANN001
    import pystray
    from pystray import Menu, MenuItem as Item

    icon = pystray.Icon("LocalFlow", make_icon("loading"), "LocalFlow")

    overlay = {"ctl": None, "visible": app.cfg.overlay}

    def refresh(state: str) -> None:
        icon.icon = make_icon(state)
        hk = app.cfg.hotkey
        icon.title = f"LocalFlow: {STATUS_TEXT.get(state, state)}  [{hk}]"
        if overlay["ctl"] is not None:
            overlay["ctl"].set_state(state)
        try:
            icon.update_menu()
        except Exception:
            pass

    def toggle_overlay(icon, item) -> None:  # noqa: ANN001
        overlay["visible"] = not overlay["visible"]
        app.cfg.overlay = overlay["visible"]
        app.cfg.save()
        if overlay["ctl"] is None and overlay["visible"]:
            from . import overlay as overlay_mod

            overlay["ctl"] = overlay_mod.create(app)
        elif overlay["ctl"] is not None:
            overlay["ctl"].set_visible(overlay["visible"])

    app.on_state = refresh

    # --- menu actions -----------------------------------------------------
    def status_text(item) -> str:  # noqa: ANN001
        return STATUS_TEXT.get(app.state, app.state)

    def record_text(item) -> str:  # noqa: ANN001
        return "Stop recording" if app.state == "recording" else "Start recording"

    def toggle_record(icon, item) -> None:  # noqa: ANN001
        if app.state == "recording":
            app.stop_recording()
        elif app.state == "idle":
            if not app.enabled:
                app.set_enabled(True)
            app.start_recording()

    def toggle_enabled(icon, item) -> None:  # noqa: ANN001
        app.toggle_enabled()

    def make_hotkey_action(spec: str):  # noqa: ANN202
        def action(icon, item) -> None:  # noqa: ANN001
            try:
                app.set_hotkey(spec)
            except Exception as exc:
                log.error("Could not set hotkey %s: %s", spec, exc)
        return action

    def make_mode_action(mode: str):  # noqa: ANN202
        def action(icon, item) -> None:  # noqa: ANN001
            app.set_hotkey(app.cfg.hotkey, mode)
        return action

    def make_output_action(mode: str):  # noqa: ANN202
        def action(icon, item) -> None:  # noqa: ANN001
            app.set_output_mode(mode)
        return action

    def last_text(item) -> str:  # noqa: ANN001
        t = app.last_text
        if not t:
            return "Last: (nothing yet)"
        return "Last: " + (t[:50] + "..." if len(t) > 50 else t)

    def quit_app(icon, item) -> None:  # noqa: ANN001
        app.shutdown()
        icon.stop()

    hotkey_items = [
        Item(label, make_hotkey_action(spec), radio=True,
             checked=lambda item, s=spec: app.cfg.hotkey == s)
        for label, spec in HOTKEY_PRESETS
    ]
    custom_checked = lambda item: app.cfg.hotkey not in {s for _, s in HOTKEY_PRESETS}  # noqa: E731
    hotkey_items += [
        Item(lambda item: f"Custom: {app.cfg.hotkey}", None, radio=True, checked=custom_checked,
             visible=custom_checked),
        Menu.SEPARATOR,
        Item("Set a custom one: run `localflow hotkey` in a terminal", None, enabled=False),
        Menu.SEPARATOR,
        Item("Hold to talk", make_mode_action("hold"), radio=True,
             checked=lambda item: app.cfg.hotkey_mode == "hold"),
        Item("Press to start, press again to stop", make_mode_action("toggle"), radio=True,
             checked=lambda item: app.cfg.hotkey_mode == "toggle"),
    ]

    output_items = [
        Item("Type into the focused app", make_output_action("type"), radio=True,
             checked=lambda item: app.cfg.output_mode == "type"),
        Item("Paste via clipboard (Cmd/Ctrl+V)", make_output_action("paste"), radio=True,
             checked=lambda item: app.cfg.output_mode == "paste"),
        Item("Copy to clipboard only", make_output_action("clipboard"), radio=True,
             checked=lambda item: app.cfg.output_mode == "clipboard"),
    ]

    icon.menu = Menu(
        Item(status_text, None, enabled=False),
        Item(lambda item: f"Hotkey: {app.cfg.hotkey}", None, enabled=False),
        Menu.SEPARATOR,
        Item(record_text, toggle_record, default=True),
        Item("Dictation on", toggle_enabled, checked=lambda item: app.enabled),
        Item("Floating widget", toggle_overlay, checked=lambda item: overlay["visible"]),
        Menu.SEPARATOR,
        Item("Hotkey", Menu(*hotkey_items)),
        Item("Output", Menu(*output_items)),
        Menu.SEPARATOR,
        Item(last_text, None, enabled=False),
        Item("Open history", lambda icon, item: _open_path(history_path())),
        Item("Open config file", lambda icon, item: _open_path(config_path())),
        Menu.SEPARATOR,
        Item("Quit LocalFlow", quit_app),
    )

    def background(icon) -> None:  # noqa: ANN001
        icon.visible = True
        if app.cfg.overlay:
            from . import overlay as overlay_mod

            overlay["ctl"] = overlay_mod.create(app)
        try:
            app.start()
        except Exception:
            log.exception("Startup failed")
            icon.stop()
            return
        app.wait()
        icon.stop()

    try:
        icon.run(setup=background)  # pystray runs setup() on its own thread
    finally:
        app.stop()
