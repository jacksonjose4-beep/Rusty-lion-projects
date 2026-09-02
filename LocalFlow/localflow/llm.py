"""Optional polish pass using a local model served by Ollama.

Off by default. When enabled, the request goes to 127.0.0.1 only. If Ollama
is not running or is slow, the deterministic cleanup result is used as is.
"""

from __future__ import annotations

import json
import logging
import urllib.error
import urllib.request

log = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "You clean up dictated text. Fix punctuation, capitalization and obvious "
    "speech-to-text errors. Remove filler words and false starts. Keep the "
    "speaker's words, tone and meaning; do not add, summarize, translate or "
    "answer anything. Preserve line breaks. Reply with the cleaned text only."
)


def polish(text: str, url: str, model: str, timeout: float = 20.0) -> str:
    if not text.strip():
        return text
    payload = {
        "model": model,
        "stream": False,
        "options": {"temperature": 0.1},
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": text},
        ],
    }
    req = urllib.request.Request(
        url.rstrip("/") + "/api/chat",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = json.loads(resp.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, OSError, ValueError) as exc:
        log.warning("Ollama unavailable (%s); using rule-based cleanup only", exc)
        return text
    cleaned = (body.get("message") or {}).get("content", "").strip()
    if not cleaned:
        return text
    # Guard against a chatty model: if the reply ballooned, it probably
    # answered the text instead of cleaning it.
    if len(cleaned) > 2 * len(text) + 40:
        log.warning("LLM reply looks like a response, not a cleanup; discarding it")
        return text
    return cleaned
