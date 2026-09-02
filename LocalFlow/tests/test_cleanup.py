from localflow.cleanup import (
    apply_replacements,
    apply_voice_commands,
    capitalize_sentences,
    clean_transcript,
    is_hallucination,
    remove_fillers,
)


def test_removes_noise_fillers():
    assert remove_fillers("Um, so I think, uh, we should ship it.") == "so I think we should ship it."
    assert remove_fillers("Hmm. Let me check.") == "Let me check."


def test_keeps_real_words_that_double_as_fillers():
    assert remove_fillers("I like this plan.") == "I like this plan."
    assert remove_fillers("It is kind of blue.") == "It is kind of blue."


def test_strips_set_apart_ambiguous_fillers():
    assert remove_fillers("I was, like, really tired.") == "I was really tired."
    assert remove_fillers("Like, I don't know.") == "I don't know."


def test_extra_fillers():
    assert remove_fillers("basically we won.", extra=["basically"]) == "we won."


def test_voice_commands_newlines_and_punctuation():
    assert apply_voice_commands("Hi Sam new line thanks for the update") == "Hi Sam\nthanks for the update"
    assert apply_voice_commands("Dear team, New paragraph. Here is the plan") == "Dear team,\n\nHere is the plan"
    assert apply_voice_commands("Are you coming question mark") == "Are you coming?"


def test_replacements_are_case_insensitive_whole_words():
    out = apply_replacements("send it to jackson jose today", {"jackson jose": "Jackson José"})
    assert out == "send it to Jackson José today"
    assert apply_replacements("the jacksons", {"jackson": "J"}) == "the jacksons"


def test_capitalization():
    assert capitalize_sentences("hello there. how are you? i am fine") == "Hello there. How are you? I am fine"
    assert capitalize_sentences("first line\nsecond line") == "First line\nSecond line"
    assert capitalize_sentences("i'm sure it's fine") == "I'm sure it's fine"


def test_hallucinations_become_empty():
    assert is_hallucination("Thank you.")
    assert is_hallucination("[BLANK_AUDIO]")
    assert is_hallucination("   ")
    assert not is_hallucination("Thank you for the report.")
    assert clean_transcript("Thanks for watching!") == ""


def test_full_pipeline():
    raw = "um, hey sarah, new line, can you, uh, send me the q3 numbers question mark"
    out = clean_transcript(raw, replacements={"q3": "Q3"})
    assert out == "Hey sarah,\nCan you send me the Q3 numbers?"


def test_pipeline_flags_can_be_disabled():
    raw = "um hello new line"
    assert clean_transcript(raw, remove_filler_words=False, voice_commands=False, capitalize=False) == raw
