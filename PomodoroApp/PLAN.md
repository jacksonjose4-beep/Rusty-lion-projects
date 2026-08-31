# FocusQuest (working title) — Pomodoro / Deep Work App — Implementation Plan

A local-first phone app for ADHD-friendly focus sessions: a Pomodoro timer,
an integrated to-do list, and a customizable "companion" character that
gives it personality and motivation. Habit-building mechanics are built on
principles from *Atomic Habits* (James Clear) — identity-based habits,
habit stacking, tiny/2-minute starts, "never miss twice," and visible
streak tracking.

This is a **planning document only** — no code has been written yet. It's
meant to be read, argued with, and adjusted before we build anything.

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
| Starting is the hardest part (activation energy) | One-tap start, no setup friction, a "tiny start" mode (2–5 min) |
| Rigid timers don't fit variable attention spans | Custom session lengths per task, not locked to 25/5 |
| Shame after a broken streak kills motivation | "Never miss twice" framing instead of streak-reset shame |
| No felt reward for invisible progress | A companion character that visibly grows/reacts to sessions |
| Losing the "why" mid-task | Attach a one-line motivation/intention to each task |
| Task-switching and distraction go unexamined | A frictionless, non-judgmental "I got distracted" log |
| Willpower-based habit advice doesn't stick | Habit stacking + identity language baked into the UI copy |

---

## What It Does

| Feature | Description |
|---|---|
| Focus Timer | Pomodoro-style timer with customizable work/break lengths, not locked to 25/5 |
| Companion character | A customizable mascot that reacts, "levels up," and evolves as you complete sessions |
| To-Do List | Tasks you attach to a focus session before starting the timer |
| Intention tag | One-line "why this matters" note per task, shown during the session |
| Streaks & habit tracking | Visual "don't break the chain" calendar, with a no-shame recovery rule |
| Distraction log | One-tap, judgment-free way to note "got pulled away" mid-session |
| Break screen | Guided break prompts (stretch, water, look away) — not just a countdown |
| Weekly review | Atomic-Habits-style reflection: time focused, streak, wins, one adjustment |
| Themes & sounds | Customizable timer sounds, character skins, color themes |
| Notifications | Session-end alerts, gentle re-engagement nudges, daily habit reminder |

---

## The Habit-Building Layer (Atomic Habits, applied)

This is the part that separates it from a stock timer app, so it's worth
spelling out how each mechanic maps to the book:

- **Identity-based habits** — copy throughout the app reinforces "you're
  someone who focuses," not "you finished a task." E.g., completing a
  session says *"That's focus-session #42. You're becoming someone who
  shows up."*
- **Habit stacking** — onboarding asks "What do you already do every day
  that we can attach a focus session to?" (e.g., "After I make coffee, I
  do one focus session.") That stack is shown as a daily reminder.
- **Make it obvious / attractive / easy / satisfying (the 4 laws)** —
  obvious: home screen shows today's planned session before anything else;
  easy: tiny-start mode removes the 25-minute commitment; satisfying: the
  companion animates immediately on session completion.
- **Two-minute rule** — every session can be started in a "tiny" mode
  (as short as 2 minutes) so starting never feels like a big ask.
- **Never miss twice** — missing one day doesn't reset a "streak level";
  the app explicitly tracks and celebrates same-week recovery instead of
  punishing a gap.
- **Habit tracking / visible progress** — a simple chain calendar (filled
  dot per day with a completed session), the mechanic Clear calls out as
  one of the most effective standalone habit tools.

---

## Tech Stack

Matches the stack already proven out in `VoiceTaskApp/` in this repo, minus
the pieces this app doesn't need (no speech-to-text, no LLM parsing):

| Layer | Choice | Why |
|---|---|---|
| Framework | Expo (managed, TypeScript) | Same proven setup as VoiceTaskApp — fast start, one codebase for iOS/Android |
| Storage | `expo-sqlite` | Local, offline-first, no account or backend required |
| Notifications | `expo-notifications` | Session-end alerts, daily reminders |
| State | `zustand` | Same minimal store pattern as VoiceTaskApp |
| Styling | `nativewind` (Tailwind for RN) | Consistent with existing app |
| Character animation | `lottie-react-native` (or `react-native-svg` for simpler sprite states) | Lightweight animated companion without heavy assets |
| Haptics | `expo-haptics` | Gentle vibration cues on session start/end — helpful sensory feedback for ADHD |
| Audio | `expo-av` | Timer completion sounds, ambient focus sounds (optional) |
| Background timer | `expo-task-manager` + `expo-background-fetch` (or a foreground-service approach) | Keep the countdown accurate if the app is backgrounded |

No backend, no account system, no cloud sync in v1 — same privacy-first,
fully-offline posture as VoiceTaskApp. Everything lives in local SQLite.

---

## Project Structure

```
PomodoroApp/
├── App.tsx
├── app.json
├── babel.config.js
├── tailwind.config.js
├── tsconfig.json
├── package.json
└── src/
    ├── navigation/
    │   └── TabNavigator.tsx          # Home / Tasks / Progress / Settings
    ├── screens/
    │   ├── HomeScreen.tsx            # Timer + companion + current task
    │   ├── TasksScreen.tsx           # To-do list, pick task for next session
    │   ├── ProgressScreen.tsx        # Streak calendar, weekly review
    │   ├── CompanionScreen.tsx       # Customize character, unlockables
    │   └── SettingsScreen.tsx        # Session lengths, sounds, reminders
    ├── components/
    │   ├── TimerRing.tsx             # Circular countdown display
    │   ├── CompanionSprite.tsx       # Animated character, reacts to state
    │   ├── TaskPicker.tsx            # Pick/attach task + intention before starting
    │   ├── DistractionLogButton.tsx  # One-tap "got distracted" log
    │   ├── BreakPrompt.tsx           # Guided break screen
    │   ├── StreakChain.tsx           # "Don't break the chain" calendar
    │   └── SessionSummaryCard.tsx    # End-of-session recap + XP gained
    ├── services/
    │   ├── db.ts                     # SQLite init + CRUD
    │   ├── timerService.ts           # Countdown logic, background-safe
    │   └── notificationService.ts    # Session-end + reminder scheduling
    ├── store/
    │   ├── useSessionStore.ts        # Active timer state
    │   ├── useTasksStore.ts
    │   ├── useCompanionStore.ts      # XP, level, unlocks, skin
    │   └── useStreakStore.ts
    ├── utils/
    │   ├── habitCopy.ts              # Centralized identity/motivation strings
    │   └── dateUtils.ts
    └── types/
        └── index.ts
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
  plannedMinutes: number;     // custom, not locked to 25
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
  name: string;
  skin: string;                // which visual variant
  xp: number;
  level: number;
}
```

---

## Screens — Detailed Breakdown

### 1. Home Screen (`HomeScreen.tsx`)
- Companion front and center — idle animation, reacts on session start/end
- Today's planned session (from habit stack) shown before anything else
- Big single "Start Focus Session" button — defaults to last-used length
- Tap to attach/change task + intention before starting
- Once running: `TimerRing`, pause, "I got distracted" tap-log, end early

### 2. Tasks Screen (`TasksScreen.tsx`)
- Simple checklist, same interaction pattern as VoiceTaskApp's TodayScreen
- Each task can carry an intention note
- Tap a task → "Start a session for this" shortcut back to Home

### 3. Progress Screen (`ProgressScreen.tsx`)
- `StreakChain` calendar — filled dot per day with ≥1 completed session
- "Never miss twice" indicator instead of a punishing streak-reset number
- Weekly review card: total focus time, sessions completed, one prompt
  ("What's one small adjustment for next week?")

### 4. Companion Screen (`CompanionScreen.tsx`)
- Current character, level, XP progress bar
- Unlockable skins/accessories earned through consistency (not just volume)
- Rename/customize companion

### 5. Settings Screen (`SettingsScreen.tsx`)
- Default work/break lengths (fully custom, no forced 25/5)
- Tiny-start mode toggle and its default length
- Notification preferences (daily habit-stack reminder time)
- Sound and haptic preferences

---

## Session Flow

```
User taps "Start Focus Session"
        │
        ▼
Pick/confirm task + intention (skippable)
        │
        ▼
Pick length: tiny (2–5m) / short / custom  →  countdown starts
        │
        ├── Distraction tap → logged silently, timer keeps running
        │
        ▼
Timer completes
        │
        ▼
Companion reacts (animation + haptic + sound)
        │
        ▼
SessionSummaryCard: time focused, XP gained, identity-affirming line
        │
        ▼
Break prompt (guided, skippable) → back to Home
```

---

## Implementation Phases

### Phase 1 — Foundation
- `npx create-expo-app PomodoroApp --template blank-typescript`
- Navigation shell (4 tabs), SQLite schema, empty Zustand stores

### Phase 2 — Core Timer
- `TimerRing`, countdown logic in `timerService.ts`, background-safe
- Start/pause/end-early, custom lengths (no hardcoded 25/5)

### Phase 3 — Tasks + Sessions
- Task CRUD, attach task + intention to a session
- Persist `FocusSession` records, wire to SQLite

### Phase 4 — Companion & Rewards
- `CompanionSprite` states (idle/reacting/leveling up)
- XP/level logic tied to completed sessions, not just raw minutes
- Unlockable skins

### Phase 5 — Habit Layer
- Habit-stack onboarding question, daily reminder notification
- `StreakChain` with "never miss twice" logic (not a hard reset)
- Distraction log (frictionless, no confirmation dialogs)

### Phase 6 — Progress & Reflection
- Weekly review card and copy
- Session history / stats

### Phase 7 — Polish
- Sound/haptic tuning, themes, empty states, onboarding flow
- Test on physical device

---

## Open Questions (for you to decide, not blockers)

- **Companion style**: a pet/creature (Forest/Finch-style), a simple
  abstract shape that changes color/form, or something else entirely?
- **Session length defaults**: what actually works for you — traditional
  25/5, or shorter to start?
- **Tone of the companion's voice**: encouraging and gentle, playful and
  a little sarcastic, or minimal/quiet?
- **Solo app or eventually social** (e.g. optional accountability/body
  doubling with a friend)? Kept out of v1 either way, but worth flagging
  early since it'd affect the data model (local-only vs. needing sync).

---

## Future Ideas (not in initial build)

- Body doubling / co-focus sessions with a friend (would require a backend)
- Ambient focus sounds / lo-fi audio built in
- Calendar integration to auto-suggest session times
- Export weekly reviews as a simple journal
- Widget for quick-start from the home screen
- Apple Watch / Wear OS companion for start/stop
