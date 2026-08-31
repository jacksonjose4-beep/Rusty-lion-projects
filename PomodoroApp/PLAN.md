# FocusQuest (working title) — Desktop Pomodoro / Deep Work Widget — Implementation Plan

A local-first **desktop app for Windows and Mac** built around a small
on-screen companion widget: a Pomodoro timer, an integrated to-do list, and
a customizable companion character (starting with a Dog and a Batman-style
option) that gives it personality and motivation. Habit-building mechanics
are built on principles from *Atomic Habits* (James Clear) — identity-based
habits, habit stacking, tiny/2-minute starts, "never miss twice," and
visible streak tracking.

This is a **planning document only** — no code has been written yet.

> **Platform update (v2 of this plan):** the original version of this plan
> assumed a phone app (matching the `VoiceTaskApp/` project already in this
> repo). Since you want a screen widget that lives on your desktop on both
> Windows and Mac, this plan now targets **Electron**, the standard way to
> ship one cross-platform desktop app with a floating always-on-top window.
> A phone companion app is still possible later — see Future Ideas.

---

## Why this app, specifically

Generic Pomodoro timers fail for ADHD brains for a few predictable reasons:
rigid 25-minute blocks that don't match how attention actually works, zero
emotional reward for starting, shame spirals when a streak breaks, and no
connection between "what I'm doing right now" and "why it matters." This
app tries to fix those specific failure points rather than just being
"another timer with a to-do list bolted on."

| Problem (ADHD-specific) | Design response |
|---|---|
| Starting is the hardest part (activation energy) | One-click start from the widget itself, no app-switching required, a "tiny start" mode (2–5 min) |
| Rigid timers don't fit variable attention spans | Fully custom session lengths, not locked to 25/5 |
| Shame after a broken streak kills motivation | "Never miss twice" framing instead of streak-reset shame |
| No felt reward for invisible progress | A companion that's *always visible on screen* and visibly reacts to sessions |
| Losing the "why" mid-task | Attach a one-line motivation/intention to each task |
| Task-switching and distraction go unexamined | A frictionless, non-judgmental "I got distracted" click |
| Willpower-based habit advice doesn't stick | Habit stacking + identity language baked into the UI copy |
| Generic timers are easy to forget exist | The widget sits on your desktop the whole time — it's not an app you have to remember to open |

---

## What It Does

| Feature | Description |
|---|---|
| Desktop widget | A small, always-on-top, draggable window showing your companion + a mini timer ring — lives on your screen while you work |
| Full app window | Opens from the widget or system tray: tasks, progress, companion settings |
| Focus Timer | Pomodoro-style timer with **fully customizable** work/break lengths — no fixed 25/5 |
| Companion character | Choose **Dog** or **Batman** to start; each has its own animations, voice lines, and tone |
| To-Do List | Tasks you attach to a focus session before starting the timer |
| Intention tag | One-line "why this matters" note per task, shown during the session |
| Streaks & habit tracking | Visual "don't break the chain" calendar, with a no-shame recovery rule |
| Distraction log | One click on the widget to note "got pulled away" mid-session, no judgment |
| Break screen | Guided break prompts (stretch, water, look away) — not just a countdown |
| Weekly review | Atomic-Habits-style reflection: time focused, streak, wins, one adjustment |
| System tray | Quick start/pause, switch companion, show/hide widget, quit |
| Notifications | Native OS notifications for session-end and daily habit reminders |

---

## The Companion Characters

Two starter options, each with a distinct tone that *is* the motivation
system — not a generic mascot with swapped colors.

### 🐶 Dog ("Buddy" — rename it)
- **Personality**: loyal, warm, endlessly encouraging, never disappointed in you
- **Animations**: idle tail-wag → sits and stays focused during a session → happy bounce + bark on completion → gentle nudge (not guilt) if you've missed a day
- **Sample voice lines**:
  - Start: *"Let's go! I'll wait right here."*
  - Mid-session (occasional, not spammy): *"Still with you."*
  - Completion: *"You did it! Good human."*
  - Missed a day: *"I missed you. Ready when you are."*

### 🦇 Batman-style ("The Bat" — rename it)
- **Personality**: disciplined, mission-driven, terse, respects the grind
- **Animations**: idle rooftop stance → "on patrol" pose during a session → cape-swoosh nod on completion → stoic, undramatic line if a day is missed
- **Sample voice lines**:
  - Start: *"Gotham can wait. Focus."*
  - Mid-session: *"Stay on mission."*
  - Completion: *"Case closed. Well done."*
  - Missed a day: *"Even the Bat rests. Back on patrol?"*

> **IP note**: Batman is a trademarked DC Comics character. Building this
> for your own personal, private use is fine. If you ever want to share,
> sell, or publicly distribute the app, this option should become an
> original "disciplined vigilante" archetype character (own name, own
> design) instead of using Batman's name/likeness directly. Flagging this
> now so it isn't a surprise later — no action needed for personal use.

Both characters plug into the same underlying animation/voice-line system,
so adding a third or fourth character later (once you know what sticks) is
just adding another data file, not new engineering.

---

## The Habit-Building Layer (Atomic Habits, applied)

- **Identity-based habits** — copy throughout the app reinforces "you're
  someone who focuses," not "you finished a task," in each character's own
  voice (Dog: *"Good human."* / Batman: *"Discipline is your cape."*).
- **Habit stacking** — onboarding asks "What do you already do every day
  that we can attach a focus session to?" That stack becomes the daily
  reminder trigger.
- **Make it obvious / attractive / easy / satisfying (the 4 laws)** —
  obvious: the widget is always on screen; easy: tiny-start mode; attractive
  and satisfying: the companion reacts instantly and visibly.
- **Two-minute rule** — every session can start in "tiny" mode (as short as
  2 minutes), because starting should never feel like a big ask.
- **Never miss twice** — missing one day doesn't reset a streak level; the
  app tracks and rewards same-week recovery instead of punishing a gap.
- **Habit tracking / visible progress** — a simple chain calendar (filled
  dot per day with a completed session).

---

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Shell | **Electron** + TypeScript | One codebase → native app on both Windows and Mac; only framework here that can do an always-on-top, frameless, draggable widget window on the desktop |
| UI | React (renderer process) | Familiar component model, reusable for both the widget view and the full app window |
| Local storage | `better-sqlite3` | Fully local, no account, no cloud — same offline-first posture as your VoiceTaskApp project |
| State | `zustand` | Same minimal store pattern used in VoiceTaskApp |
| Widget window | Electron `BrowserWindow` (frameless, transparent, `alwaysOnTop`, `skipTaskbar`) | The floating companion widget |
| System tray | Electron `Tray` API | Quick controls without opening the full window |
| Companion animation | Lottie (`lottie-react`) or a sprite-sheet, per character | Idle / active / completion / missed-day states |
| Notifications | Electron `Notification` API | Native Windows + Mac notification banners |
| Packaging | `electron-builder` | Produces a Mac `.dmg` and a Windows `.exe`/`.msi` from one build |

Everything runs locally on your machine — no backend, no account, no cloud
sync, matching the privacy-first approach already used in VoiceTaskApp.

---

## Project Structure

```
PomodoroApp/
├── package.json
├── tsconfig.json
├── electron-builder.yml            # Mac .dmg + Windows .exe/.msi config
└── src/
    ├── main/                       # Electron main process
    │   ├── index.ts                # App lifecycle, window creation
    │   ├── widgetWindow.ts         # Frameless always-on-top widget window
    │   ├── mainWindow.ts           # Full app window (tasks/progress/settings)
    │   ├── tray.ts                 # System tray menu
    │   ├── ipc.ts                  # IPC handlers (timer sync, DB calls)
    │   └── notifications.ts
    ├── preload/
    │   └── index.ts                # Safe bridge between main and renderer
    ├── shared/
    │   ├── types.ts
    │   └── db.ts                   # better-sqlite3 schema + CRUD
    └── renderer/
        ├── widget/                 # Widget window UI
        │   ├── WidgetApp.tsx       # Companion sprite + mini timer ring
        │   └── CompanionSprite.tsx
        ├── app/                    # Full app window UI
        │   ├── screens/
        │   │   ├── HomeScreen.tsx
        │   │   ├── TasksScreen.tsx
        │   │   ├── ProgressScreen.tsx
        │   │   ├── CompanionScreen.tsx    # Pick Dog/Batman, rename, customize
        │   │   └── SettingsScreen.tsx     # Custom session lengths, reminders
        │   └── components/
        │       ├── TimerRing.tsx
        │       ├── TaskPicker.tsx
        │       ├── StreakChain.tsx
        │       └── SessionSummaryCard.tsx
        ├── store/
        │   ├── useSessionStore.ts
        │   ├── useTasksStore.ts
        │   ├── useCompanionStore.ts       # Active character, xp, level
        │   └── useStreakStore.ts
        └── companions/
            ├── dog.ts               # Dog's animation states + voice lines
            └── batman.ts            # Batman's animation states + voice lines
```

---

## Data Models

```typescript
export interface Task {
  id: string;
  text: string;
  intention: string | null;   // "why this matters" one-liner
  completed: boolean;
  createdAt: string;
}

export interface FocusSession {
  id: string;
  taskId: string | null;
  plannedMinutes: number;     // fully custom, set by the user each time or by default
  actualMinutes: number;
  distractionCount: number;
  completedAt: string | null; // null if abandoned
  startedAt: string;
}

export interface StreakDay {
  date: string;                // YYYY-MM-DD
  sessionsCompleted: number;
  minutesFocused: number;
}

export interface Companion {
  characterId: 'dog' | 'batman';
  displayName: string;         // user-renamed, e.g. "Buddy" or "The Bat"
  xp: number;
  level: number;
}

export interface CompanionVoiceLines {
  onStart: string[];
  onMidSession: string[];
  onCompletion: string[];
  onMissedDay: string[];
}

export interface SessionLengthPreset {
  label: string;               // "Deep work", "Quick sprint", custom name
  workMinutes: number;
  breakMinutes: number;
}
```

---

## The Widget

The core new piece versus the original plan — worth detailing on its own:

- **Always-on-top, frameless window**, small (roughly 160×160px), draggable
  by clicking and holding the companion itself (`-webkit-app-region: drag`
  on the widget's root element).
- **Idle state**: companion does its idle animation, no timer showing.
- **Active session**: companion switches to its "focused" pose, a thin
  ring/progress bar shows time remaining, single click pauses.
- **Right-click (or a small gear icon on hover)**: quick menu — start a
  tiny session, open full app, switch companion, hide widget.
- **Completion**: companion plays its completion animation + voice line as
  a native notification, whether or not the full app window is open.
- **Position and always-on-top state persist** between app launches.
- **Auto-launch on login** as an optional setting, so the widget is just
  always there without you having to remember to start the app.

---

## Session Flow

```
Click companion in the widget (or tray → Start Session)
        │
        ▼
Pick/confirm task + intention (skippable) — opens a small popover, not the full window
        │
        ▼
Set length: use last-used, a quick preset, or type a fully custom minute count
        │
        ▼
Widget switches to "focused" pose, ring counts down
        │
        ├── Click "distracted" icon → logged silently, timer keeps running
        │
        ▼
Timer completes
        │
        ▼
Companion reacts (animation + voice line) + native OS notification
        │
        ▼
SessionSummaryCard (in full app, or a small popover from the widget)
        │
        ▼
Break prompt (guided, skippable) → widget returns to idle
```

---

## Implementation Phases

### Phase 1 — Electron Shell
- Scaffold Electron + TypeScript + React, main/preload/renderer split
- Create the widget window (frameless, transparent, always-on-top) and the
  full app window, both showing placeholder content
- System tray icon with a basic menu

### Phase 2 — Local Storage
- `better-sqlite3` schema + CRUD for tasks, sessions, streaks, companion
- IPC handlers so both windows read/write the same local DB

### Phase 3 — Core Timer
- Countdown logic (owned by the main process, synced to both windows via
  IPC so the widget and full app never disagree)
- Fully custom session lengths, start/pause/end-early

### Phase 4 — Companion System
- Dog and Batman animation states + voice-line data files
- `CompanionSprite` component driven by session state
- Companion picker + rename in Settings

### Phase 5 — Tasks + Sessions
- Task CRUD in the full app window
- Attach task + intention to a session from the widget's quick popover

### Phase 6 — Habit Layer
- Habit-stack onboarding question, daily reminder notification
- `StreakChain` with "never miss twice" logic
- Distraction log (one click, no confirmation dialogs)

### Phase 7 — Progress & Reflection
- Weekly review screen, session history

### Phase 8 — Packaging
- `electron-builder` config for Mac `.dmg` and Windows `.exe`/`.msi`
- Auto-launch-on-login option
- Code signing (can be skipped for personal-only use, needed if ever
  distributed to avoid OS security warnings)

### Phase 9 — Polish
- Widget drag-to-reposition, show/hide, click-through mode
- Sound design per completion, empty states, first-run onboarding

---

## Open Questions (for you to decide, not blockers)

- **Where should the widget sit by default** — a screen corner, or wherever
  you drag it and it remembers?
- **Solo app or eventually social** (e.g. optional accountability/body
  doubling with a friend)? Would require a backend later — kept out of v1
  either way, but affects the data model if you want to plan ahead.
- **Auto-launch on login** — on by default, or something you opt into?

---

## Future Ideas (not in initial build)

- A companion mobile app (using the same Expo/React Native pattern as
  VoiceTaskApp) that mirrors streaks/tasks, syncing with the desktop app
- More companion characters beyond Dog and Batman, community/custom skins
- Ambient focus sounds / lo-fi audio built into a session
- Calendar integration to auto-suggest session times
- Export weekly reviews as a simple journal
- Menu-bar-only mode (Mac) / true system-tray-only mode (Windows) with no
  visible widget, for people who find it distracting
