"""Turn raw Whisper output into text you would actually want typed.

Everything here is deterministic and runs in microseconds. The optional
LLM pass lives in `llm.py` and is off by default.
"""

from __future__ import annotations

import re

DEFAULT_FILLERS = [
    "um", "umm", "uh", "uhh", "uhm", "er", "erm", "ah", "hmm", "mm",
    "you know", "i mean", "sort of", "kind of", "like",
]

# Fillers that are also real words. Only removed when they stand alone,
# surrounded by punctuation or sentence boundaries, e.g. ", like, ".
AMBIGUOUS_FILLERS = {"like", "sort of", "kind of", "you know", "i mean"}

# Spoken command -> literal text. Matched as whole phrases, case-insensitive.
VOICE_COMMANDS: dict[str, str] = {
    "new line": "\n",
    "newline": "\n",
    "line break": "\n",
    "new paragraph": "\n\n",
    "paragraph break": "\n\n",
    "period": ".",
    "full stop": ".",
    "comma": ",",
    "question mark": "?",
    "exclamation mark": "!",
    "exclamation point": "!",
    "colon": ":",
    "semicolon": ";",
    "open quote": "“",
    "close quote": "”",
    "open paren": "(",
    "close paren": ")",
    "dash": " - ",
    "hyphen": "-",
    "ellipsis": "...",
    "tab key": "\t",
}

# Whisper tends to emit these when fed silence or background noise.
HALLUCINATION_PATTERNS = [
    r"^\s*(thank you|thanks)( for watching| so much)?[.!]?\s*$",
    r"^\s*(subtitles?|captions?) by .*$",
    r"^\s*\[.*\]\s*$",          # [Music], [BLANK_AUDIO], [inaudible]
    r"^\s*\(.*\)\s*$",          # (silence)
    r"^\s*you\s*$",
    r"^\s*bye[.!]?\s*$",
]

_WS = re.compile(r"[ \t]+")


def _phrase_pattern(phrase: str) -> re.Pattern[str]:
    words = [re.escape(w) for w in phrase.split()]
    return re.compile(r"\b" + r"\s+".join(words) + r"\b", re.IGNORECASE)


def is_hallucination(text: str) -> bool:
    stripped = text.strip()
    if not stripped:
        return True
    return any(re.match(p, stripped, re.IGNORECASE) for p in HALLUCINATION_PATTERNS)


def remove_fillers(text: str, extra: list[str] | None = None) -> str:
    fillers = {f.lower() for f in DEFAULT_FILLERS} | {f.lower() for f in (extra or [])}
    out = text
    for filler in sorted(fillers, key=len, reverse=True):
        word = _phrase_pattern(filler).pattern
        if filler in AMBIGUOUS_FILLERS:
            # Real words too, so only strip them when Whisper set them apart:
            # ", like, " in the middle, or "Like, " opening a sentence.
            out = re.sub(r",\s*" + word + r"\s*,", " ", out, flags=re.IGNORECASE)
            out = re.sub(
                r"(^|[.!?]\s+|\n)" + word + r",\s*", r"\1", out, flags=re.IGNORECASE
            )
        else:
            # Pure noise: drop the word and any comma/period glued to it.
            out = re.sub(r",?\s*" + word + r"(?:[,.](?!\d))?", " ", out, flags=re.IGNORECASE)
    return _tidy(out)


def apply_voice_commands(text: str) -> str:
    out = text
    for phrase in sorted(VOICE_COMMANDS, key=len, reverse=True):
        literal = VOICE_COMMANDS[phrase]
        # Whisper often writes "New line." or ", new paragraph,". Eat the
        # punctuation it attached to the command itself.
        # A comma before "new line" is the speaker's; keep it. A comma before
        # "question mark" is Whisper guessing at a pause; drop it.
        lead = r"\s*" if literal.startswith("\n") else r"[,\s]*"
        pat = re.compile(lead + _phrase_pattern(phrase).pattern + r"[.,]?", re.IGNORECASE)
        out = pat.sub(literal, out)
    return _tidy(out)


def apply_replacements(text: str, replacements: dict[str, str]) -> str:
    out = text
    for spoken, written in replacements.items():
        if not spoken.strip():
            continue
        out = _phrase_pattern(spoken).sub(written, out)
    return out


def capitalize_sentences(text: str) -> str:
    def cap(match: re.Match[str]) -> str:
        return match.group(1) + match.group(2).upper()

    out = re.sub(r"(^|[.!?]\s+|\n+)([a-z])", cap, text)
    # Standalone "i" pronoun.
    out = re.sub(r"\bi\b(?=['\s,.!?]|$)", "I", out)
    return out


def _tidy(text: str) -> str:
    lines = []
    for line in text.split("\n"):
        line = _WS.sub(" ", line).strip()
        line = re.sub(r"\s+([,.!?;:])", r"\1", line)   # no space before punctuation
        line = re.sub(r"([,.!?;:])(?=[A-Za-z])", r"\1 ", line)  # space after it
        line = re.sub(r"([,.!?;:])\1+", r"\1", line)   # collapse ",," or ".."
        line = re.sub(r",\s*([.!?])", r"\1", line)     # ", ." -> "."
        line = re.sub(r"\.{4,}", "...", line)
        lines.append(line)
    out = "\n".join(lines)
    out = re.sub(r"\n{3,}", "\n\n", out)
    # Keep a deliberate trailing "new line"; drop stray spaces only.
    return out.lstrip().rstrip(" \t")


def clean_transcript(
    text: str,
    *,
    remove_filler_words: bool = True,
    extra_fillers: list[str] | None = None,
    voice_commands: bool = True,
    capitalize: bool = True,
    replacements: dict[str, str] | None = None,
) -> str:
    """Full deterministic pipeline. Returns "" for silence/hallucinations."""
    if is_hallucination(text):
        return ""
    out = text.strip()
    if remove_filler_words:
        out = remove_fillers(out, extra_fillers)
    if voice_commands:
        out = apply_voice_commands(out)
    if replacements:
        out = apply_replacements(out, replacements)
    if capitalize:
        out = capitalize_sentences(out)
    out = _tidy(out)
    if is_hallucination(out):
        return ""
    return out
