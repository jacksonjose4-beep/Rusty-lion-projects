import os

from localflow.instance import InstanceLock, read_pid


def test_second_lock_is_refused_until_release(tmp_path, monkeypatch):
    monkeypatch.setenv("LOCALFLOW_HOME", str(tmp_path))
    a, b = InstanceLock(), InstanceLock()
    assert a.acquire()
    assert read_pid() == os.getpid()
    assert not b.acquire()
    a.release()
    assert b.acquire()
    b.release()
    assert read_pid() is None


def test_only_real_localflow_processes_match():
    from localflow.instance import is_localflow_argv

    assert is_localflow_argv(["/Users/x/Applications/LocalFlow.app/Contents/MacOS/LocalFlow"])
    assert is_localflow_argv(["/x/.venv/bin/python3", "-m", "localflow", "run"])
    assert is_localflow_argv(["/x/.venv/bin/localflow"])
    assert not is_localflow_argv(["/bin/bash", "-c", "cd localflow && pytest"])
    assert not is_localflow_argv(["/usr/bin/vim", "localflow/app.py"])
    assert not is_localflow_argv(["python3", "-c", "import localflow"])
