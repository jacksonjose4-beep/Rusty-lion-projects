# LocalFlow

Push-to-talk voice dictation that runs entirely on your own computer.
Hold a hotkey, talk, let go. A second or two later the cleaned-up text is
typed into whatever app has focus: Slack, email, a code editor, a browser.

It is a self-hosted stand-in for tools like Wispr Flow, with one difference
that matters: **no audio, transcript, or keystroke ever leaves the machine.**
There is no account, no API key, no telemetry, and no server. The only
network request it can make is a one-time model download, and even that can
be done ahead of time on another machine (see *Fully offline install*).

> A note on workplace policy: many company AI rules are about company data
> being sent to third-party AI services. LocalFlow sends nothing anywhere,
> which is usually the whole point of those rules. It is still your
> responsibility to confirm that running local speech-to-text on a work
> machine is allowed. This project does not disable or hide anything.

## How it works

```
hotkey held  ->  mic (16 kHz)  ->  Whisper on CPU/GPU  ->  cleanup  ->  keystrokes
                 sounddevice       faster-whisper          fillers,      pynput
                                   (CTranslate2)           commands,
                                                           dictionary
```

* **Speech to text**: [faster-whisper](https://github.com/SYSTRAN/faster-whisper),
  a CTranslate2 port of OpenAI Whisper. Runs on CPU; uses CUDA automatically if
  you have an NVIDIA GPU and the CUDA libraries installed.
* **Cleanup** (deterministic, instant): drops "um", "uh", ", like,"; turns
  "new line" / "new paragraph" / "question mark" into the real thing;
  capitalises sentences; applies your personal dictionary; throws away the
  "Thanks for watching!" hallucinations Whisper produces on silence.
* **Optional polish** with a local LLM through [Ollama](https://ollama.com)
  at `127.0.0.1`. Off by default; still on-device when on.
* **Output**: simulated keystrokes (default), or paste via clipboard, or
  copy only.
* **Menu bar icon** showing idle / recording / transcribing / paused, with
  manual start and stop, an on/off switch, and hotkey and output pickers.

## Install

Requirements: Python 3.9+, a microphone, and roughly 1 GB of disk for the
`small` model or 200 MB for `base`.

### macOS / Linux

```bash
cd LocalFlow
bash scripts/setup.sh
source .venv/bin/activate
localflow
```

Linux needs PortAudio first (`sudo apt install portaudio19-dev` on
Debian/Ubuntu). On Wayland desktops global hotkeys and simulated typing are
restricted by the compositor; use an X11 session or set
`output_mode` to `clipboard`.

### Windows

```powershell
cd LocalFlow
powershell -ExecutionPolicy Bypass -File scripts\setup.ps1
.\.venv\Scripts\localflow.exe
```

### macOS permissions

The first time you run it, macOS will ask for **Microphone** access. You also
need to add your terminal app (Terminal, iTerm, Warp, VS Code...) under
*System Settings > Privacy & Security > Accessibility* and
*> Input Monitoring*, then restart the terminal. Without Accessibility the
hotkey is seen but nothing gets typed.

## Use

1. Run `localflow`. It loads the model (a few seconds), prints `Ready`, and
   puts a microphone icon in the menu bar (macOS) or system tray (Windows).
2. Click into any text field.
3. Hold **Ctrl+Shift+Space**, speak, release. You will hear a short beep on
   start and stop, and the icon turns red while recording and orange while
   transcribing.
4. The text appears where your cursor is.

The icon's menu gives you manual control too:

* **Start / Stop recording** without touching the hotkey.
* **Dictation on** checkbox to pause the whole thing (the icon greys out).
* **Hotkey** submenu with common combos, single-key push-to-talk options
  like right Option or right Cmd, and hold vs toggle mode.
* **Output** submenu to switch between typing, pasting, and clipboard-only.
* Last dictation, history, config file, and Quit.

Changes made from the menu are saved to the config file and take effect
immediately.

### The floating widget

On macOS a small dark pill floats at the right edge of the screen, above
every other window, with three buttons:

* **Mic** (top): click to start recording, click again to stop. It turns red
  while recording and orange while transcribing.
* **Dot** (middle): dictation on or off. The mic dims with a slash when off.
* **Note** (bottom): opens your dictation history.

Drag it anywhere; the position is remembered. Clicking it never steals
focus, so the text still lands in the app you were typing in. Hide or show
it from the menu bar icon ("Floating widget"), or start with
`localflow --no-overlay`. It is macOS-only for now; Windows and Linux get
the tray icon.

## Run it like a normal app

You do not need a terminal after the first setup.

### macOS: build LocalFlow.app

```bash
cd LocalFlow
bash scripts/make_mac_app.sh
```

This writes `~/Applications/LocalFlow.app`. Open it from Finder or
Spotlight. There is no Dock icon and no window: look for the mic in the menu
bar and the floating widget at the right edge. The first launch asks for
Microphone and Accessibility; approve both, then also add LocalFlow under
*System Settings > Privacy & Security > Input Monitoring*, quit it from the
menu bar icon and open it again. The app is a thin launcher for the
virtualenv in this folder, so `git pull` updates it in place; rebuild only
if you move the folder.

To start it at login: *System Settings > General > Login Items*, press +,
pick LocalFlow.

Logs go to `~/.localflow/localflow.log`.

### Windows: Start Menu shortcut

```powershell
powershell -ExecutionPolicy Bypass -File scripts\make_windows_shortcut.ps1
```

Creates Start Menu and Desktop shortcuts that launch LocalFlow with no
console window. Copy the shortcut into `shell:startup` to run at login.

### Not working? Run the doctor

```bash
localflow doctor
```

It checks the macOS permissions, records two seconds from the microphone
and reports the level, confirms the model is cached, and then echoes every
key press it can see for eight seconds so you can watch your hotkey fire.
Each line is either `OK` or `FAIL` with the exact fix.

### Pick your own hotkey

```bash
localflow hotkey                  # press the combo you want, release, done
localflow hotkey "<alt_r>"        # or name it: right Option, hold to talk
localflow hotkey "<f13>" --mode toggle
```

Names: `<ctrl>`, `<alt>` (Option), `<shift>`, `<cmd>`, `<space>`, `<f1>`
to `<f20>`, single letters, and `_l` / `_r` variants for one side only.
The Fn key on Mac keyboards is not visible to apps, so it cannot be used.
On a Mac, a single right-hand modifier such as `<alt_r>` is the closest
thing to Wispr's Fn key, and it is also the most robust choice (see
Secure Keyboard Entry under Troubleshooting).

Type the command on its own line; a trailing `# comment` from the examples
above would be passed to the command as extra arguments.

Say "new line", "new paragraph", "period", "comma", "question mark" to
insert them. Everything else is typed as spoken, minus the fillers.

Useful commands:

```bash
localflow devices                     # list microphones
localflow test-mic --transcribe       # 3 s recording, prints level and text
localflow transcribe clip.wav         # run a WAV through the whole pipeline
localflow history                     # last 20 dictations (local file)
localflow config                      # show settings
localflow config --set model=small    # change a setting
```

## Configure

Settings live in `~/.localflow/config.json` (created by `localflow init`).
Every key can be changed with `localflow config --set key=value`; JSON values
work for lists and dicts.

| Key | Default | Notes |
|-----|---------|-------|
| `hotkey` | `<ctrl>+<shift>+<space>` | Any combo, e.g. `<alt>+z`, `<cmd>+<f13>` |
| `hotkey_mode` | `hold` | `hold` = push to talk. `toggle` = press to start, press to stop |
| `enable_hotkey` | `null` | Optional second combo that pauses/resumes dictation, e.g. `<ctrl>+<shift>+<f12>` |
| `tray` | `true` | Menu bar / tray icon. `localflow --no-tray` for terminal only |
| `overlay` | `true` | Floating on-screen widget (macOS). `localflow --no-overlay` to hide |
| `model` | `base` | `tiny`, `base`, `small`, `medium`, `large-v3`, `distil-large-v3`, or a folder path |
| `device` | `auto` | `cpu` or `cuda` |
| `language` | `en` | ISO code, or `null` to auto-detect |
| `output_mode` | `type` | `type`, `paste` (clipboard + Ctrl/Cmd+V), `clipboard` (copy only) |
| `replacements` | `{}` | Personal dictionary: `{"jira": "Jira", "k eight s": "k8s"}` |
| `extra_fillers` | `[]` | More words to drop, e.g. `["basically", "actually"]` |
| `remove_fillers`, `voice_commands`, `capitalize_sentences` | `true` | Switch cleanup stages off |
| `llm_cleanup` | `false` | Polish with Ollama at `ollama_url` using `ollama_model` |
| `initial_prompt` | `null` | Text that biases Whisper toward your vocabulary, e.g. "Kubernetes, Terraform, Jackson" |
| `max_recording_seconds` | `120` | Auto-stop so a stuck key cannot record forever |
| `history` | `true` | Log dictations to `~/.localflow/history.jsonl`. Set `false` to keep nothing |
| `sounds` | `true` | Beep on start/stop |

Picking a model on a laptop CPU, for a 10 second sentence:

| Model | Delay | Accuracy |
|-------|-------|----------|
| `tiny` | under 1 s | rough |
| `base` | about 1 s | fine for chat |
| `small` | 2 to 3 s | good, the sweet spot for most people |
| `distil-large-v3` | 3 to 5 s | best English accuracy without a GPU |
| `large-v3` | needs a GPU to feel instant | best overall |

### Local LLM polish (optional)

If you already run [Ollama](https://ollama.com):

```bash
ollama pull llama3.2:3b
localflow config --set llm_cleanup=true --set ollama_model=llama3.2:3b
```

Whisper output goes through the model with a "clean this up, change
nothing else" instruction. If Ollama is down or slow, LocalFlow silently
falls back to the rule-based cleanup, so dictation never stalls.

## Fully offline install

If the work machine cannot reach huggingface.co, download the model
somewhere that can and copy the folder over:

```bash
pip install faster-whisper
python scripts/download_model.py small          # writes ./models/small
# copy models/small to the work machine, then:
localflow config --set model=/path/to/models/small
```

You can also set `HF_HUB_OFFLINE=1` in the environment to make sure the
Hugging Face client never even tries.

## Privacy checklist

* Audio is held in memory only and discarded after transcription. Nothing is
  written to disk unless `history` is on, and then it is a plain text file
  you own at `~/.localflow/history.jsonl`.
* Outbound connections: the model download (huggingface.co) on first run,
  and `127.0.0.1:11434` only if you turn on Ollama polish. That is the
  complete list; grep the code for `urllib` and `http` to verify.
* No background updater, no crash reporting, no analytics.

## Development

```bash
pip install -e ".[dev]"
pytest
```

The tests cover cleanup, hotkey parsing, config, and the full pipeline with
a fake transcriber, so they run without a microphone or a model download.

## Troubleshooting

* **Hotkey does nothing on macOS**: run `localflow doctor`. Almost always it
  is one of: the terminal app is not listed under Accessibility *and* Input
  Monitoring; you added a different app than the one you launched from
  (Terminal vs iTerm vs VS Code); or you did not quit and reopen the
  terminal after granting it (Cmd+Q, not just closing the window). If both
  permissions are on and it still fails, also add the Python binary that
  `localflow doctor` prints on its first line to Input Monitoring: press
  the + button, then Cmd+Shift+G, and paste the path.
* **Doctor shows Ctrl and Shift but never Space** (or any letter key):
  macOS **Secure Keyboard Entry** is on. While any app holds it, ordinary
  key presses are hidden from every listener and only modifier keys get
  through. `localflow doctor` names the app holding it. Either switch it
  off (Terminal menu > Secure Keyboard Entry, or iTerm2 menu > Secure
  Keyboard Entry), or, if a corporate tool holds it, pick a modifier-only
  hotkey, which keeps working regardless:

  ```bash
  localflow hotkey "<alt_r>"          # right Option, hold to talk
  localflow hotkey "<ctrl>+<alt>"     # hold both
  ```
* **Menu bar icon is missing**: `pip install pystray Pillow` inside the
  venv, or the app fell back to terminal mode and said why in the log.
* **Text is typed into the wrong place / characters dropped**: try
  `output_mode=paste`, or raise `type_interval` to `0.01`.
* **Windows: works everywhere except one app**: that app is probably running
  as Administrator; run LocalFlow elevated too.
* **"Could not open microphone"**: `localflow devices`, then
  `localflow config --set input_device=<index>`.
* **Slow**: use a smaller model, set `beam_size=1`, or set `device=cuda`
  if you have an NVIDIA GPU (install `nvidia-cublas-cu12` and
  `nvidia-cudnn-cu12` in the venv).
* **Whisper keeps typing "Thank you."**: that is its silence hallucination;
  LocalFlow filters the common ones, add more to `HALLUCINATION_PATTERNS` in
  `localflow/cleanup.py` if you see others.
