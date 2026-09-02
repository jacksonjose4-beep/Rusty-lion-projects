import pytest

PIL = pytest.importorskip("PIL")

from localflow.tray import COLORS, make_icon  # noqa: E402


@pytest.mark.parametrize("state", list(COLORS))
def test_icons_render_for_every_state(state):
    img = make_icon(state, 32)
    assert img.size == (32, 32)
    # centre pixel is on the disc, so it is opaque
    assert img.getpixel((16, 16))[3] == 255
