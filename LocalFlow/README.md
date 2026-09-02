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

## Install

Requirements: Python 3.10+, a microphone, and roughly 1 GB of disk for the
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

1. Run `localflow`. It loads the model (a few seconds) and prints `Ready`.
2. Click into any text field.
3. Hold **Ctrl+Shift+Space**, speak, release. You will hear a short beep on
   start and stop.
4. The text appears where your cursor is.

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

* **Hotkey does nothing on macOS**: Accessibility + Input Monitoring for the
  terminal app, then restart it.
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
