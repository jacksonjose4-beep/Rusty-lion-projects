"""Pre-download a Whisper model on a machine with internet, for offline installs.

Usage:
    python scripts/download_model.py base            # downloads to ./models/base
    python scripts/download_model.py small ~/models  # custom destination

Copy the resulting folder to the offline machine and point LocalFlow at it:
    localflow config --set model=/path/to/models/base
"""

import sys
from pathlib import Path

from faster_whisper.utils import download_model


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    size = sys.argv[1]
    dest = Path(sys.argv[2] if len(sys.argv) > 2 else "models") / size
    dest.mkdir(parents=True, exist_ok=True)
    path = download_model(size, output_dir=str(dest))
    print(f"Model {size!r} saved to {path}")
    print(f"Use it with: localflow config --set model={path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
