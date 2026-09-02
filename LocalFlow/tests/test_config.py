import json

from localflow.config import Config


def test_roundtrip(tmp_path):
    cfg = Config(model="small", hotkey="<alt>+z", replacements={"gh": "GitHub"})
    path = cfg.save(tmp_path / "config.json")
    loaded = Config.load(path)
    assert loaded == cfg
    assert json.loads(path.read_text())["model"] == "small"


def test_unknown_keys_are_ignored(tmp_path):
    path = tmp_path / "config.json"
    path.write_text(json.dumps({"model": "tiny", "bogus": 1}))
    cfg = Config.load(path)
    assert cfg.model == "tiny"
    assert not hasattr(cfg, "bogus")


def test_validate():
    assert Config().validate() == []
    bad = Config(hotkey_mode="sometimes", output_mode="fax", max_recording_seconds=0)
    problems = bad.validate()
    assert len(problems) == 3
