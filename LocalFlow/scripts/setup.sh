#!/usr/bin/env bash
# One-shot setup for macOS and Linux. Run from the LocalFlow directory:
#   bash scripts/setup.sh
set -euo pipefail
cd "$(dirname "$0")/.."

# Prefer the newest Python on the machine. macOS ships an old 3.9 at
# /usr/bin/python3; Homebrew or python.org installs are faster and better
# supported by the wheels we need.
PY=""
for candidate in python3.13 python3.12 python3.11 python3.10 python3.9 python3; do
  if command -v "$candidate" >/dev/null 2>&1; then
    if "$candidate" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 9) else 1)'; then
      PY="$(command -v "$candidate")"
      break
    fi
  fi
done
if [[ -z "$PY" ]]; then
  echo "Python 3.9 or newer not found." >&2
  echo "macOS: brew install python@3.12   (or download from python.org)" >&2
  echo "Ubuntu/Debian: sudo apt install python3 python3-venv" >&2
  exit 1
fi
echo "Using $PY ($("$PY" --version))"
if "$PY" -c 'import sys; sys.exit(0 if sys.version_info < (3, 10) else 1)'; then
  echo "Note: this Python is old. If the install fails, run: brew install python@3.12"
  echo "and re-run this script."
fi

if [[ "$(uname -s)" == "Linux" ]] && ! ldconfig -p 2>/dev/null | grep -q libportaudio; then
  echo "PortAudio not found. On Debian/Ubuntu: sudo apt install portaudio19-dev python3-tk"
  echo "On Fedora: sudo dnf install portaudio-devel. Then re-run this script."
  exit 1
fi

# Start clean; a half-built venv from an earlier failed run is the usual cause of odd errors.
[[ -f .venv/pyvenv.cfg ]] && rm -rf .venv
"$PY" -m venv .venv
# shellcheck disable=SC1091
source .venv/bin/activate
pip install --upgrade pip >/dev/null
pip install -e .

localflow init
echo
echo "Done. Start dictating with:"
echo "  source .venv/bin/activate && localflow"
echo
echo "The first run downloads the Whisper model (~150 MB for 'base') and caches it locally."
if [[ "$(uname -s)" == "Darwin" ]]; then
  echo "macOS: grant your terminal app Microphone, Accessibility and Input Monitoring"
  echo "under System Settings > Privacy & Security, then restart the terminal."
fi
