"""Small system notifications, so the app can speak up without a window."""

from __future__ import annotations

import logging
import platform
import shutil
import subprocess

log = logging.getLogger(__name__)


def notify(title: str, message: str) -> None:
    system = platform.system()
    try:
        if system == "Darwin":
            script = 'display notification "{}" with title "{}"'.format(
                message.replace("\\", "\\\\").replace('"', '\\"'),
                title.replace("\\", "\\\\").replace('"', '\\"'))
            subprocess.Popen(["osascript", "-e", script],
                             stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        elif system == "Linux" and shutil.which("notify-send"):
            subprocess.Popen(["notify-send", title, message],
                             stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        # Windows: the tray icon's own notify() is used where available.
    except Exception:
        log.debug("notification failed", exc_info=True)
