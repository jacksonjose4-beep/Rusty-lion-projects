"""Single-instance lock so two copies of LocalFlow never fight over the mic."""

from __future__ import annotations

import logging
import os
import signal
from pathlib import Path

from .config import config_dir

log = logging.getLogger(__name__)


def pid_path() -> Path:
    return config_dir() / "localflow.pid"


class InstanceLock:
    def __init__(self) -> None:
        self._fh = None

    def acquire(self) -> bool:
        """True if this process now owns the lock; False if another instance holds it."""
        path = pid_path()
        path.parent.mkdir(parents=True, exist_ok=True)
        try:
            import fcntl
        except ImportError:  # Windows: fall back to a liveness check on the pid file
            other = read_pid()
            if other and _alive(other):
                return False
            path.write_text(str(os.getpid()))
            return True
        self._fh = open(path, "a+")
        try:
            fcntl.flock(self._fh.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError:
            self._fh.close()
            self._fh = None
            return False
        self._fh.seek(0)
        self._fh.truncate()
        self._fh.write(str(os.getpid()))
        self._fh.flush()
        return True

    def release(self) -> None:
        if self._fh is not None:
            try:
                self._fh.close()
            except OSError:
                pass
            self._fh = None
        try:
            pid_path().unlink()
        except OSError:
            pass


def read_pid() -> int | None:
    try:
        return int(pid_path().read_text().strip() or 0) or None
    except (OSError, ValueError):
        return None


def _alive(pid: int) -> bool:
    try:
        os.kill(pid, 0)
        return True
    except OSError:
        return False


def stop_running() -> list[int]:
    """Terminate other LocalFlow processes. Returns the pids signalled."""
    pids: list[int] = []
    me = os.getpid()
    recorded = read_pid()
    if recorded and recorded != me and _alive(recorded):
        pids.append(recorded)
    for pid in _find_localflow_pids():
        if pid != me and pid not in pids:
            pids.append(pid)
    for pid in pids:
        try:
            os.kill(pid, signal.SIGTERM)
        except OSError:
            pass
    return pids


def _find_localflow_pids() -> list[int]:
    """Processes that *are* LocalFlow, judged by argv, never by a substring match."""
    try:
        import subprocess

        out = subprocess.run(["ps", "-axo", "pid=,args="], capture_output=True, text=True,
                             timeout=5).stdout
    except Exception:
        return []
    found: list[int] = []
    for line in out.splitlines():
        parts = line.split()
        if len(parts) < 2:
            continue
        try:
            pid = int(parts[0])
        except ValueError:
            continue
        if is_localflow_argv(parts[1:]):
            found.append(pid)
    return found


def is_localflow_argv(argv: list[str]) -> bool:
    exe = argv[0]
    if exe.endswith("LocalFlow.app/Contents/MacOS/LocalFlow"):
        return True
    if exe.endswith("/localflow") or exe.endswith("\\localflow.exe"):
        return True
    base = os.path.basename(exe).lower()
    if base.startswith("python") and len(argv) >= 3 and argv[1] == "-m" and argv[2] == "localflow":
        return True
    return False
