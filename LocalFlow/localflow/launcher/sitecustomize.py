"""Entry point used by LocalFlow.app.

The app bundle's main executable is a copy of the Python interpreter, so
that macOS attributes Microphone / Accessibility / Input Monitoring to
LocalFlow.app itself. LaunchServices starts that interpreter with no
arguments, so Info.plist sets PYTHONPATH to this folder and Python imports
this module during startup; it then runs `localflow run` and exits.

Only active when LOCALFLOW_APP_LAUNCH=1 (set by the bundle's LSEnvironment),
so a plain `python` from the venv is unaffected.
"""

import os
import sys

if os.environ.get("LOCALFLOW_APP_LAUNCH") == "1":
    import runpy
    import traceback

    # Never let a child Python process (anything the app spawns) see the
    # trigger again, or it would start a second copy of the app.
    os.environ.pop("LOCALFLOW_APP_LAUNCH", None)
    os.environ.pop("PYTHONPATH", None)
    sys.path[:] = [p for p in sys.path if not p.rstrip("/").endswith("launcher")]

    log_dir = os.path.join(os.path.expanduser("~"), ".localflow")
    os.makedirs(log_dir, exist_ok=True)
    log_path = os.path.join(log_dir, "launch.log")
    try:
        fd = os.open(log_path, os.O_WRONLY | os.O_APPEND | os.O_CREAT, 0o644)
        os.dup2(fd, 1)
        os.dup2(fd, 2)
        sys.stdout = os.fdopen(1, "a", buffering=1)
        sys.stderr = os.fdopen(2, "a", buffering=1)
    except OSError:
        pass

    args = os.environ.get("LOCALFLOW_APP_ARGS", "run").split()
    sys.argv = ["localflow"] + args
    print(f"=== LocalFlow.app launch: {sys.executable} argv={sys.argv[1:]}", flush=True)
    code = 0
    try:
        runpy.run_module("localflow", run_name="__main__", alter_sys=True)
    except SystemExit as exc:
        code = exc.code if isinstance(exc.code, int) else (0 if exc.code is None else 1)
    except BaseException:
        traceback.print_exc()
        code = 1
    finally:
        sys.stdout.flush()
        sys.stderr.flush()
        os._exit(code)
