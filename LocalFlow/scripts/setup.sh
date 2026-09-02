#!/usr/bin/env bash
# One-shot setup for macOS and Linux. Run from the LocalFlow directory:
#   bash scripts/setup.sh
set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 not found. Install Python 3.10+ first." >&2
  exit 1
fi

if [[ "$(uname -s)" == "Linux" ]] && ! ldconfig -p 2>/dev/null | grep -q libportaudio; then
  echo "PortAudio not found. On Debian/Ubuntu: sudo apt install portaudio19-dev python3-tk"
  echo "On Fedora: sudo dnf install portaudio-devel. Then re-run this script."
  exit 1
fi

python3 -m venv .venv
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
