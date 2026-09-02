"""Floating on-screen widget: a small vertical pill with three round buttons.

    [ mic ]    click: start / stop recording (red while recording)
    [ dot ]    click: dictation on / off
    [ note ]   click: open the dictation history

Pure layout logic lives here so it can be unit tested. The native window is
platform specific: macOS uses AppKit (see overlay_mac.py). Other platforms
currently run without the widget and rely on the tray icon.
"""

from __future__ import annotations

import logging
import platform
from dataclasses import dataclass

log = logging.getLogger(__name__)

WIDTH = 56
HEIGHT = 184
BUTTON_RADIUS = 21
MIC_RADIUS = 23


@dataclass(frozen=True)
class Button:
    name: str
    cx: float
    cy: float
    r: float


def layout(width: float = WIDTH, height: float = HEIGHT) -> list[Button]:
    """Button circles in a bottom-left origin coordinate system (AppKit style)."""
    cx = width / 2
    gap = height / 3
    return [
        Button("mic", cx, height - gap / 2, MIC_RADIUS),
        Button("power", cx, height - gap * 1.5, BUTTON_RADIUS),
        Button("notes", cx, gap / 2, BUTTON_RADIUS),
    ]


def hit_test(x: float, y: float, width: float = WIDTH, height: float = HEIGHT) -> str | None:
    for b in layout(width, height):
        if (x - b.cx) ** 2 + (y - b.cy) ** 2 <= b.r ** 2:
            return b.name
    return None


def clamp_position(x: float, y: float, screen: tuple[float, float, float, float],
                   width: float = WIDTH, height: float = HEIGHT) -> tuple[float, float]:
    """Keep the widget inside (sx, sy, sw, sh)."""
    sx, sy, sw, sh = screen
    x = min(max(x, sx), sx + sw - width)
    y = min(max(y, sy), sy + sh - height)
    return x, y


def default_position(screen: tuple[float, float, float, float],
                     width: float = WIDTH, height: float = HEIGHT) -> tuple[float, float]:
    """Hug the right edge, vertically centred, like the reference widget."""
    sx, sy, sw, sh = screen
    return sx + sw - width - 10, sy + (sh - height) / 2


def create(app):  # noqa: ANN001, ANN201
    """Build the native overlay for this platform. Returns a controller with
    set_state(state), set_visible(bool), or None if unsupported."""
    if platform.system() == "Darwin":
        try:
            from . import overlay_mac

            return overlay_mac.create(app)
        except Exception as exc:
            log.warning("Floating widget unavailable: %s", exc)
            return None
    log.info("Floating widget is macOS-only for now; use the tray icon on this platform")
    return None
