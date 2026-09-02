"""AppKit implementation of the floating widget (macOS only).

Runs inside the NSApplication loop that pystray already owns. All AppKit
calls are marshalled onto the main thread with performSelectorOnMainThread.
"""

from __future__ import annotations

import logging
import math

import objc
from AppKit import (
    NSBackingStoreBuffered,
    NSBezierPath,
    NSColor,
    NSPanel,
    NSScreen,
    NSView,
)
from Foundation import NSMakePoint, NSMakeRect, NSObject

from . import overlay as geo

log = logging.getLogger(__name__)

# Constants, with numeric fallbacks in case a pyobjc build lacks the name.
try:
    from AppKit import NSWindowStyleMaskBorderless, NSWindowStyleMaskNonactivatingPanel
except ImportError:  # pragma: no cover
    NSWindowStyleMaskBorderless, NSWindowStyleMaskNonactivatingPanel = 0, 1 << 7
try:
    from AppKit import NSStatusWindowLevel
except ImportError:  # pragma: no cover
    NSStatusWindowLevel = 25
try:
    from AppKit import (
        NSWindowCollectionBehaviorCanJoinAllSpaces,
        NSWindowCollectionBehaviorFullScreenAuxiliary,
        NSWindowCollectionBehaviorStationary,
    )
except ImportError:  # pragma: no cover
    NSWindowCollectionBehaviorCanJoinAllSpaces = 1 << 0
    NSWindowCollectionBehaviorStationary = 1 << 4
    NSWindowCollectionBehaviorFullScreenAuxiliary = 1 << 8

STATE_COLORS = {
    "loading": (0.45, 0.45, 0.47),
    "idle": (0.24, 0.24, 0.26),
    "recording": (0.90, 0.22, 0.22),
    "processing": (0.95, 0.62, 0.15),
    "off": (0.18, 0.18, 0.20),
}


def _rgba(r: float, g: float, b: float, a: float = 1.0):  # noqa: ANN202
    return NSColor.colorWithCalibratedRed_green_blue_alpha_(r, g, b, a)


class LocalFlowOverlayView(NSView):
    def initWithFrame_(self, frame):  # noqa: N802
        self = objc.super(LocalFlowOverlayView, self).initWithFrame_(frame)
        if self is None:
            return None
        self._state = "loading"
        self._enabled = True
        self._handlers = {}
        self._down = None
        self._dragging = False
        return self

    # ---- state (called on the main thread via performSelector) ----------
    def setStateName_(self, name):  # noqa: N802
        self._state = str(name)
        self.setNeedsDisplay_(True)

    def setEnabledFlag_(self, flag):  # noqa: N802
        try:
            self._enabled = bool(flag.boolValue()) if hasattr(flag, "boolValue") else bool(flag)
        except Exception:
            self._enabled = True
        self.setNeedsDisplay_(True)

    # ---- drawing ----------------------------------------------------------
    def isFlipped(self):  # noqa: N802
        return False

    def drawRect_(self, rect):  # noqa: N802
        try:
            self._draw()
        except Exception:
            log.exception("Widget draw failed")

    def _draw(self) -> None:
        bounds = self.bounds()
        w, h = bounds.size.width, bounds.size.height
        pill = NSBezierPath.bezierPathWithRoundedRect_xRadius_yRadius_(bounds, w / 2, w / 2)
        _rgba(0.10, 0.10, 0.11, 0.94).setFill()
        pill.fill()

        for b in geo.layout(w, h):
            if b.name == "mic":
                self._draw_mic(b)
            elif b.name == "power":
                self._draw_power(b)
            else:
                self._draw_notes(b)

    def _circle(self, b, color, fill=True, width=2.0):  # noqa: ANN001
        path = NSBezierPath.bezierPathWithOvalInRect_(
            NSMakeRect(b.cx - b.r, b.cy - b.r, 2 * b.r, 2 * b.r))
        if fill:
            color.setFill()
            path.fill()
        else:
            color.setStroke()
            path.setLineWidth_(width)
            path.stroke()

    def _draw_mic(self, b):  # noqa: ANN001
        r, g, bl = STATE_COLORS.get(self._state, STATE_COLORS["idle"])
        if not self._enabled and self._state in ("idle", "off"):
            r, g, bl = STATE_COLORS["off"]
        self._circle(b, _rgba(r, g, bl))
        if self._state == "recording":
            self._circle(geo.Button("ring", b.cx, b.cy, b.r + 3), _rgba(0.9, 0.22, 0.22, 0.45),
                         fill=False, width=3.0)
        white = _rgba(1, 1, 1, 0.95 if self._enabled else 0.45)
        cx, cy = b.cx, b.cy
        # capsule
        cap = NSBezierPath.bezierPathWithRoundedRect_xRadius_yRadius_(
            NSMakeRect(cx - 4.5, cy - 2, 9, 15), 4.5, 4.5)
        white.setFill()
        cap.fill()
        # cradle
        arc = NSBezierPath.bezierPath()
        arc.appendBezierPathWithArcWithCenter_radius_startAngle_endAngle_(
            NSMakePoint(cx, cy + 1), 8.5, 180, 360)
        arc.setLineWidth_(2.0)
        arc.setLineCapStyle_(1)
        white.setStroke()
        arc.stroke()
        # stem and base
        stem = NSBezierPath.bezierPath()
        stem.moveToPoint_(NSMakePoint(cx, cy - 7.5))
        stem.lineToPoint_(NSMakePoint(cx, cy - 11))
        stem.moveToPoint_(NSMakePoint(cx - 5, cy - 11))
        stem.lineToPoint_(NSMakePoint(cx + 5, cy - 11))
        stem.setLineWidth_(2.0)
        stem.setLineCapStyle_(1)
        stem.stroke()
        if not self._enabled:
            slash = NSBezierPath.bezierPath()
            slash.moveToPoint_(NSMakePoint(cx - 10, cy - 10))
            slash.lineToPoint_(NSMakePoint(cx + 10, cy + 10))
            slash.setLineWidth_(2.5)
            _rgba(1, 1, 1, 0.8).setStroke()
            slash.stroke()

    def _draw_power(self, b):  # noqa: ANN001
        self._circle(b, _rgba(0.0, 0.0, 0.0, 1.0))
        ring = geo.Button("ring", b.cx, b.cy, 8.5)
        self._circle(ring, _rgba(1, 1, 1, 0.95), fill=False, width=2.0)
        if self._enabled:
            self._circle(geo.Button("dot", b.cx, b.cy, 4.5), _rgba(1, 1, 1, 0.95))

    def _draw_notes(self, b):  # noqa: ANN001
        self._circle(b, _rgba(0.0, 0.0, 0.0, 1.0))
        white = _rgba(1, 1, 1, 0.95)
        cx, cy = b.cx, b.cy
        page = NSBezierPath.bezierPathWithRoundedRect_xRadius_yRadius_(
            NSMakeRect(cx - 7, cy - 7, 14, 14), 3, 3)
        page.setLineWidth_(2.0)
        white.setStroke()
        page.stroke()
        lines = NSBezierPath.bezierPath()
        for dy in (3, 0, -3):
            lines.moveToPoint_(NSMakePoint(cx - 3.5, cy + dy))
            lines.lineToPoint_(NSMakePoint(cx + 3.5, cy + dy))
        lines.setLineWidth_(1.5)
        lines.setLineCapStyle_(1)
        lines.stroke()

    # ---- mouse ------------------------------------------------------------
    def acceptsFirstMouse_(self, event):  # noqa: N802
        return True  # respond to the click without stealing focus from the user's app

    def mouseDown_(self, event):  # noqa: N802
        self._down = self.convertPoint_fromView_(event.locationInWindow(), None)
        self._dragging = False

    def mouseDragged_(self, event):  # noqa: N802
        if self._down is None or self._dragging:
            return
        p = self.convertPoint_fromView_(event.locationInWindow(), None)
        if math.hypot(p.x - self._down.x, p.y - self._down.y) > 4:
            self._dragging = True
            try:
                self.window().performWindowDragWithEvent_(event)
            except Exception:
                pass

    def mouseUp_(self, event):  # noqa: N802
        if self._down is not None and not self._dragging:
            p = self.convertPoint_fromView_(event.locationInWindow(), None)
            name = geo.hit_test(p.x, p.y, self.bounds().size.width, self.bounds().size.height)
            handler = self._handlers.get(name)
            if handler is not None:
                try:
                    handler()
                except Exception:
                    log.exception("Overlay button %s failed", name)
        self._down = None
        self._dragging = False


class OverlayController(NSObject):
    """Owns the panel. Public API: set_state, set_enabled, set_visible."""

    def initWithApp_(self, app):  # noqa: N802
        self = objc.super(OverlayController, self).init()
        if self is None:
            return None
        self._app = app
        self._panel = None
        self._view = None
        return self

    # main thread only
    def build_(self, _):  # noqa: N802
        # An exception here would surface inside AppKit's run loop, so catch
        # everything: a missing widget must never take the app down.
        try:
            self._build()
        except Exception:
            log.exception("Floating widget failed to build; continuing without it")
            self._panel = None
            self._view = None

    def _build(self) -> None:
        cfg = self._app.cfg
        screen = NSScreen.mainScreen()
        vf = screen.visibleFrame() if screen is not None else None
        rect = ((vf.origin.x, vf.origin.y, vf.size.width, vf.size.height) if vf is not None
                else (0, 0, 1440, 900))
        if cfg.overlay_position and len(cfg.overlay_position) == 2:
            x, y = geo.clamp_position(float(cfg.overlay_position[0]),
                                      float(cfg.overlay_position[1]), rect)
        else:
            x, y = geo.default_position(rect)

        # No Dock icon: LocalFlow lives in the menu bar and this widget.
        try:
            from AppKit import NSApplication

            NSApplication.sharedApplication().setActivationPolicy_(1)  # accessory
        except Exception:
            pass

        style = NSWindowStyleMaskBorderless | NSWindowStyleMaskNonactivatingPanel
        panel = NSPanel.alloc().initWithContentRect_styleMask_backing_defer_(
            NSMakeRect(x, y, geo.WIDTH, geo.HEIGHT), style, NSBackingStoreBuffered, False)
        panel.setLevel_(NSStatusWindowLevel)
        panel.setOpaque_(False)
        panel.setBackgroundColor_(NSColor.clearColor())
        panel.setHasShadow_(True)
        panel.setHidesOnDeactivate_(False)
        panel.setFloatingPanel_(True)
        panel.setBecomesKeyOnlyIfNeeded_(True)
        panel.setReleasedWhenClosed_(False)
        panel.setMovableByWindowBackground_(False)
        panel.setCollectionBehavior_(
            NSWindowCollectionBehaviorCanJoinAllSpaces
            | NSWindowCollectionBehaviorStationary
            | NSWindowCollectionBehaviorFullScreenAuxiliary)

        view = LocalFlowOverlayView.alloc().initWithFrame_(NSMakeRect(0, 0, geo.WIDTH, geo.HEIGHT))
        view._handlers = {
            "mic": self._on_mic,
            "power": self._on_power,
            "notes": self._on_notes,
        }
        view.setToolTip_("LocalFlow: click the mic to start/stop, the dot to pause, "
                         "the note to open history. Drag to move.")
        panel.setContentView_(view)
        panel.setDelegate_(self)
        panel.orderFrontRegardless()

        self._panel = panel
        self._view = view
        self._view.setStateName_(self._app.state)
        self._view.setEnabledFlag_(self._app.enabled)
        log.info("Floating widget shown at (%.0f, %.0f)", x, y)

    def setVisibleFlag_(self, flag):  # noqa: N802
        try:
            if self._panel is None:
                return
            if bool(flag):
                self._panel.orderFrontRegardless()
            else:
                self._panel.orderOut_(None)
        except Exception:
            log.exception("Could not toggle the floating widget")

    def windowDidMove_(self, notification):  # noqa: N802
        try:
            if self._panel is None:
                return
            f = self._panel.frame()
            self._app.cfg.overlay_position = [float(f.origin.x), float(f.origin.y)]
            self._app.cfg.save()
        except Exception:
            log.debug("Could not save widget position", exc_info=True)

    # ---- button handlers (main thread) ----------------------------------
    def _on_mic(self) -> None:
        app = self._app
        if app.state == "recording":
            app.stop_recording()
        elif app.state == "idle":
            if not app.enabled:
                app.set_enabled(True)
            app.start_recording()

    def _on_power(self) -> None:
        self._app.toggle_enabled()

    def _on_notes(self) -> None:
        from .history import history_path
        from .tray import _open_path

        path = history_path()
        if not path.exists():
            path.parent.mkdir(parents=True, exist_ok=True)
            path.touch()
        _open_path(path)

    # ---- thread-safe public API -------------------------------------------
    def set_state(self, state: str) -> None:
        if self._view is not None:
            self._view.performSelectorOnMainThread_withObject_waitUntilDone_(
                "setStateName:", state, False)
            self._view.performSelectorOnMainThread_withObject_waitUntilDone_(
                "setEnabledFlag:", self._app.enabled, False)

    def set_visible(self, visible: bool) -> None:
        self.performSelectorOnMainThread_withObject_waitUntilDone_(
            "setVisibleFlag:", bool(visible), False)


def create(app):  # noqa: ANN001, ANN201
    controller = OverlayController.alloc().initWithApp_(app)
    # Called from pystray's setup thread; the panel must be made on the main thread.
    controller.performSelectorOnMainThread_withObject_waitUntilDone_("build:", None, True)
    return controller
