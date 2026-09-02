#!/usr/bin/env bash
# Build a double-clickable LocalFlow.app (menu bar app, no Dock icon, no terminal).
#   bash scripts/make_mac_app.sh            # -> ~/Applications/LocalFlow.app
#   bash scripts/make_mac_app.sh /Applications/LocalFlow.app
#
# The bundle's main executable is a copy of your virtualenv's Python binary,
# so macOS attributes Microphone / Accessibility / Input Monitoring prompts
# to LocalFlow.app itself and lists it in System Settings.
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$(pwd)"
PY="$ROOT/.venv/bin/python"
if [[ ! -x "$PY" ]]; then
  echo "No .venv found. Run: bash scripts/setup.sh" >&2
  exit 1
fi
if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "This script builds a macOS .app bundle; run it on a Mac." >&2
  exit 1
fi

ARCH="$("$PY" -c 'import platform; print(platform.machine())')"
REALPY="$("$PY" -c 'import os, sys; print(os.path.realpath(sys.executable))')"
BASE="$("$PY" -c 'import sys; print(sys.base_prefix)')"
PYVER="$("$PY" -c 'import sys; print("%d.%d" % sys.version_info[:2])')"
echo "Virtualenv: $ROOT/.venv (Python $PYVER, $ARCH)"
echo "Interpreter: $REALPY"

APP="${1:-$HOME/Applications/LocalFlow.app}"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
EXE="$APP/Contents/MacOS/LocalFlow"

# --- main executable: the interpreter itself -------------------------------
cp "$REALPY" "$EXE"
chmod +x "$EXE"
if lipo -info "$EXE" 2>/dev/null | grep -q "Architectures in the fat file"; then
  lipo -thin "$ARCH" "$EXE" -output "$EXE.thin" && mv "$EXE.thin" "$EXE"
fi
# Re-point relative library references at the real Python framework.
otool -L "$EXE" | awk 'NR>1 {print $1}' | grep -E '^@(executable_path|loader_path|rpath)' | while read -r dep; do
  case "$dep" in
    *Python*|*libpython*)
      if [[ -f "$BASE/Python" ]]; then
        install_name_tool -change "$dep" "$BASE/Python" "$EXE"
      elif [[ -f "$BASE/lib/libpython$PYVER.dylib" ]]; then
        install_name_tool -change "$dep" "$BASE/lib/libpython$PYVER.dylib" "$EXE"
      fi
      ;;
  esac
done

# --- make the bundle behave as the virtualenv -------------------------------
cp "$ROOT/.venv/pyvenv.cfg" "$APP/Contents/pyvenv.cfg"
ln -s "$ROOT/.venv/lib" "$APP/Contents/lib"
LAUNCHER_DIR="$APP/Contents/Resources/launcher"
mkdir -p "$LAUNCHER_DIR"
cp "$ROOT/localflow/launcher/sitecustomize.py" "$LAUNCHER_DIR/sitecustomize.py"

# --- Info.plist ---------------------------------------------------------------
if [[ "$ARCH" == "arm64" ]]; then
  ARCH_KEYS='  <key>LSArchitecturePriority</key><array><string>arm64</string></array>
  <key>LSRequiresNativeExecution</key><true/>'
else
  ARCH_KEYS='  <key>LSArchitecturePriority</key><array><string>x86_64</string></array>'
fi
cat > "$APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>LocalFlow</string>
  <key>CFBundleDisplayName</key><string>LocalFlow</string>
  <key>CFBundleIdentifier</key><string>com.localflow.app</string>
  <key>CFBundleVersion</key><string>0.1.0</string>
  <key>CFBundleShortVersionString</key><string>0.1.0</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleExecutable</key><string>LocalFlow</string>
  <key>CFBundleIconFile</key><string>LocalFlow</string>
  <key>LSMinimumSystemVersion</key><string>11.0</string>
  <key>LSUIElement</key><true/>
  <key>NSHighResolutionCapable</key><true/>
$ARCH_KEYS
  <key>LSEnvironment</key>
  <dict>
    <key>LOCALFLOW_APP_LAUNCH</key><string>1</string>
    <key>PYTHONPATH</key><string>$LAUNCHER_DIR</string>
    <key>PYTHONUNBUFFERED</key><string>1</string>
  </dict>
  <key>NSMicrophoneUsageDescription</key>
  <string>LocalFlow listens to your voice and transcribes it on this Mac. Audio never leaves the computer.</string>
  <key>NSAppleEventsUsageDescription</key>
  <string>LocalFlow uses this to show notifications.</string>
</dict>
</plist>
PLIST

# --- icon ---------------------------------------------------------------------
ICONSET="$(mktemp -d)/LocalFlow.iconset"
mkdir -p "$ICONSET"
"$PY" - "$ICONSET" <<'PYICON'
import sys
from localflow.tray import make_icon
out = sys.argv[1]
for size in (16, 32, 64, 128, 256, 512):
    make_icon("idle", size).save(f"{out}/icon_{size}x{size}.png")
    make_icon("idle", size * 2).save(f"{out}/icon_{size}x{size}@2x.png")
PYICON
iconutil -c icns "$ICONSET" -o "$APP/Contents/Resources/LocalFlow.icns"

# --- sign (ad hoc) so permissions stick to this bundle ------------------------
codesign --force --deep --sign - "$APP" >/dev/null 2>&1 || true

# --- verify the embedded interpreter can see the virtualenv -------------------
echo
echo "Verifying..."
if ! "$EXE" -c 'import sys, localflow, numpy, faster_whisper, pystray; print("  prefix:", sys.prefix); print("  localflow", localflow.__version__, "imports OK")'; then
  echo "The embedded interpreter could not import the app. Check the messages above." >&2
  exit 1
fi

# LaunchServices caches the old bundle; register the new one.
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f "$APP" >/dev/null 2>&1 || true

echo
echo "Built $APP"
echo
echo "Next:"
echo "  1. Open it (Spotlight: LocalFlow). No Dock icon: look for the mic in the menu bar,"
echo "     the floating widget at the right edge, and a 'LocalFlow is running' notification."
echo "  2. Approve the Microphone and Accessibility prompts. Then System Settings >"
echo "     Privacy & Security > Input Monitoring: enable LocalFlow (press + if it is not"
echo "     listed, Cmd+Shift+G, paste $APP)."
echo "  3. Quit from the menu bar icon and open it again after granting permissions."
echo "  4. Start at login: System Settings > General > Login Items > + > LocalFlow."
echo
echo "Logs: ~/.localflow/localflow.log and ~/.localflow/launch.log"
