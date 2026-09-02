from localflow.output import _split_keep


def test_split_keeps_newlines_and_tabs_as_separate_chunks():
    assert _split_keep("a\nb\tc", "\n\t") == ["a", "\n", "b", "\t", "c"]
    assert _split_keep("\n\n", "\n\t") == ["\n", "\n"]
    assert _split_keep("plain", "\n\t") == ["plain"]
