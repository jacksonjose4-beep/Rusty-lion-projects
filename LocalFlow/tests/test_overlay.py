import platform

from localflow.overlay import (HEIGHT, WIDTH, clamp_position, create, default_position,
                               hit_test, layout)


def test_three_buttons_stacked_top_to_bottom():
    names = [b.name for b in layout()]
    assert names == ["mic", "power", "notes"]
    ys = [b.cy for b in layout()]
    assert ys == sorted(ys, reverse=True)  # bottom-left origin: mic has the largest y


def test_hit_test_finds_each_button_and_misses_gaps():
    for b in layout():
        assert hit_test(b.cx, b.cy) == b.name
    assert hit_test(0, 0) is None
    assert hit_test(WIDTH / 2, HEIGHT / 3) is None  # between power and notes


def test_positions_stay_on_screen():
    screen = (0, 0, 1440, 900)
    assert clamp_position(-50, 2000, screen) == (0, 900 - HEIGHT)
    x, y = default_position(screen)
    assert x + WIDTH <= 1440 and 0 <= y <= 900 - HEIGHT


def test_create_is_safe_on_non_mac():
    if platform.system() != "Darwin":
        assert create(object()) is None
