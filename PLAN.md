# VoiceTask App — Implementation Plan

A local, privacy-first phone app for capturing tasks, reminders, and thoughts
via voice or text. Fully offline-capable.

---

## What It Does

| Feature | Description |
|---------|-------------|
| Voice input | Hold a button, speak, release. Whisper transcribes on-device. |
| Text input | Type instead of speaking — same pipeline, same result. |
| Daily Todos | Checklist-style tasks for today with priority indicators. |
| Long-term Reminders | Scheduled items with push notifications. |
| Thoughts | Chronological quick-capture feed for ideas that pop up mid-day. |
| Offline drafts | When Ollama is unreachable, transcripts are saved and retried later. |

---

## Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Framework | Expo (managed, TypeScript) | Fastest cross-platform start, huge ecosystem |
| Speech-to-text | `whisper.rn` (on-device Whisper) | Fully private, works without internet |
| Task parsing | Ollama on local PC (same WiFi) | Private LLM, no cloud API key needed |
| Storage | `expo-sqlite` | Local SQLite, offline-first |
| Notifications | `expo-notifications` | Scheduled local push notifications |
| Navigation | `@react-navigation/native` + `bottom-tabs` | Standard Expo navigation |
| State | `zustand` | Minimal, boilerplate-free global state |
| HTTP | `axios` | Ollama API calls |
| Styling | `nativewind` (Tailwind for RN) | Fast, consistent UI |
| Audio | `expo-av` | Record audio for Whisper |

---

## Project Structure

```
VoiceTaskApp/
├── App.tsx
├── app.json
├── babel.config.js
├── tailwind.config.js
├── tsconfig.json
├── package.json
└── src/
    ├── navigation/
    │   └── TabNavigator.tsx          # 4-tab bottom nav
    ├── screens/
    │   ├── TodayScreen.tsx           # Daily todos
    │   ├── RemindersScreen.tsx       # Long-term reminders
    │   ├── ThoughtsScreen.tsx        # Chronological thoughts feed
    │   └── SettingsScreen.tsx        # Ollama URL, Whisper model
    ├── components/
    │   ├── InputBar.tsx              # Bottom voice+text input (shared)
    │   ├── VoiceRecorder.tsx         # Hold-to-record with waveform
    │   ├── DraftBanner.tsx           # "N items waiting to parse" banner
    │   ├── TodoItem.tsx              # Checkbox row with swipe-to-delete
    │   ├── ReminderCard.tsx          # Reminder with date badge
    │   └── ThoughtCard.tsx           # Thought bubble with relative time
    ├── services/
    │   ├── whisperService.ts         # Load model, transcribe audio file
    │   ├── ollamaService.ts          # POST transcript, parse JSON response
    │   ├── notificationService.ts    # Schedule & cancel local notifications
    │   └── db.ts                     # SQLite init + all CRUD operations
    ├── store/
    │   ├── useTodosStore.ts
    │   ├── useRemindersStore.ts
    │   ├── useThoughtsStore.ts
    │   └── useDraftsStore.ts         # Pending transcripts queue
    ├── utils/
    │   ├── dateUtils.ts              # Relative time, date grouping helpers
    │   └── ollamaPrompt.ts           # System prompt template
    └── types/
        └── index.ts                  # All TypeScript interfaces
```

---

## Data Models

```typescript
// src/types/index.ts

export interface Todo {
  id: string;
  text: string;
  completed: boolean;
  date: string;           // YYYY-MM-DD — which day this belongs to
  priority: 'low' | 'medium' | 'high';
  createdAt: string;      // ISO datetime
}

export interface Reminder {
  id: string;
  text: string;
  scheduledAt: string;    // ISO datetime
  recurring: 'none' | 'daily' | 'weekly';
  notificationId: string | null;
  completed: boolean;
  createdAt: string;
}

export interface Thought {
  id: string;
  text: string;
  createdAt: string;      // ISO datetime, sorted newest-first
  sourceType: 'voice' | 'text';
}

export interface Draft {
  id: string;
  transcript: string;
  createdAt: string;
  status: 'pending' | 'processing' | 'failed';
}
```

---

## SQLite Schema

```sql
-- src/services/db.ts

CREATE TABLE IF NOT EXISTS todos (
  id          TEXT PRIMARY KEY,
  text        TEXT NOT NULL,
  completed   INTEGER DEFAULT 0,
  date        TEXT NOT NULL,       -- YYYY-MM-DD
  priority    TEXT DEFAULT 'medium',
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reminders (
  id              TEXT PRIMARY KEY,
  text            TEXT NOT NULL,
  scheduled_at    TEXT NOT NULL,   -- ISO datetime
  recurring       TEXT DEFAULT 'none',
  notification_id TEXT,
  completed       INTEGER DEFAULT 0,
  created_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS thoughts (
  id          TEXT PRIMARY KEY,
  text        TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  source_type TEXT DEFAULT 'text'
);

CREATE TABLE IF NOT EXISTS drafts (
  id          TEXT PRIMARY KEY,
  transcript  TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  status      TEXT DEFAULT 'pending'  -- pending | processing | failed
);
```

---

## Full Data Flow

```
User holds mic button
        │
        ▼
expo-av records audio → saves to temp .m4a file
        │
        ▼
whisper.rn transcribes audio on-device
  (tiny/base/small model, ~150MB–500MB)
        │
        ▼
    Transcript ready
        │
        ├─── Ollama reachable? ──YES──► POST to http://PC_IP:11434/api/generate
        │                                     System prompt + transcript
        │                                           │
        │                                           ▼
        │                               Parse JSON: { type, text, datetime, priority }
        │                                           │
        │                                           ▼
        │                               Create Todo / Reminder / Thought in SQLite
        │                                           │
        │                                           ▼
        │                               If Reminder → scheduleNotificationAsync
        │                                           │
        │                                           ▼
        │                               Zustand store updated → UI re-renders
        │
        └─── Ollama unreachable? ──NO──► Save transcript as Draft in SQLite
                                         Show DraftBanner: "1 item waiting to parse"
                                         Background retry every 5 min
                                         When connected: auto-process all drafts
```

---

## Ollama Integration

### Endpoint
```
POST http://<PC_IP>:11434/api/generate
```

### System Prompt (in `src/utils/ollamaPrompt.ts`)
```
You are a task and note parser. Given a voice note transcript, extract the
intent and return ONLY a valid JSON object — no explanation, no other text.

Output format:
{
  "type": "todo" | "reminder" | "thought",
  "text": "cleaned up action text",
  "datetime": "ISO 8601 string or null",
  "priority": "low" | "medium" | "high"
}

Rules:
- "todo"     = task for today with no specific future date
- "reminder" = future scheduled event with a specific date/time
- "thought"  = idea, observation, or note with no action needed
- Extract dates from phrases like "tomorrow", "next Monday", "at 3pm"
- Keep "text" concise and imperative (e.g. "Call John" not "remind me to call")
- "priority" only applies to todos; default to "medium"

Today's date is: {DATE}
```

### Recommended Models (in order of preference)
| Model | Size | Speed | Notes |
|-------|------|-------|-------|
| `phi3:mini` | ~2.3GB | Fast | Great for structured JSON |
| `llama3.2:3b` | ~2GB | Fast | Very capable |
| `mistral:7b` | ~4GB | Medium | Overkill but very accurate |

---

## Screens — Detailed Breakdown

### 1. Today Screen (`TodayScreen.tsx`)
- **Header**: "Today — Mon, Feb 28"
- **Todo list**: Checkbox rows grouped by priority
  - Red dot = high, yellow = medium, green = low
  - Tap checkbox to complete (strikethrough animation)
  - Swipe left to delete
- **Empty state**: "Nothing for today. Add a task below."
- **InputBar** pinned at bottom
- **DraftBanner** at top if drafts pending

### 2. Reminders Screen (`RemindersScreen.tsx`)
- **Grouped sections**: Today · This Week · This Month · Later
- **Card layout**: Text + datetime badge + recurring icon
- **Swipe right**: Mark complete
- **Swipe left**: Delete (cancels notification)
- **Tap**: Edit date/time with DateTimePicker
- **InputBar** pinned at bottom

### 3. Thoughts Screen (`ThoughtsScreen.tsx`)
- **Search bar** at top (filter by keywords)
- **Chronological feed** newest first
- Each thought: text + relative time ("3 hours ago")
- Tap to expand, long-press to delete
- **InputBar** pinned at bottom
- Voice thoughts tagged with mic icon, text thoughts with keyboard icon

### 4. Settings Screen (`SettingsScreen.tsx`)
- **Ollama section**
  - Base URL field (e.g., `http://192.168.1.42:11434`)
  - Model selector (phi3:mini / llama3.2:3b / mistral:7b)
  - "Test Connection" button → shows latency or error
- **Whisper section**
  - Model size selector: Tiny (~75MB) / Base (~150MB) / Small (~500MB)
  - Download button with progress bar
  - Currently loaded model indicator
- **App section**
  - Morning summary notification toggle (8am daily todo list)
  - Clear all data (confirmation dialog)

---

## Shared Component — InputBar

The most important component. Appears on all 3 main screens.

```
┌─────────────────────────────────────────┐
│  [🎤 Hold to speak]    [⌨️ Type instead] │
└─────────────────────────────────────────┘

While recording:
┌─────────────────────────────────────────┐
│  ████░░░░░░  Recording...  [Release]    │
└─────────────────────────────────────────┘

Processing:
┌─────────────────────────────────────────┐
│  ⟳  Transcribing...                    │
└─────────────────────────────────────────┘
```

- **Voice mode**: Hold mic → record → release → Whisper → Ollama → create item
- **Text mode**: Text field → type → send → Ollama → create item
- Shows which screen it's on as context hint to the user

---

## Notification Scheduling

```typescript
// src/services/notificationService.ts

// Schedule a reminder
async function scheduleReminder(reminder: Reminder): Promise<string> {
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: "Reminder",
      body: reminder.text,
      sound: true,
    },
    trigger: {
      date: new Date(reminder.scheduledAt),
    },
  });
  return id; // stored as notificationId in SQLite
}

// Cancel when deleted or completed
async function cancelReminder(notificationId: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(notificationId);
}

// Optional: 8am daily todo summary
async function scheduleDailySummary(): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: { title: "Today's tasks", body: "Tap to see your todo list" },
    trigger: { hour: 8, minute: 0, repeats: true },
  });
}
```

---

## Offline Draft System

```typescript
// useDraftsStore.ts + background processing

// When Ollama is unreachable:
// 1. Save transcript to drafts table with status = 'pending'
// 2. Show DraftBanner with count

// DraftBanner component:
// "2 voice notes waiting to be parsed  [Retry now]"

// Background check (every 5 min using expo-task-manager or interval):
async function retryPendingDrafts() {
  const isReachable = await ollamaService.ping();
  if (!isReachable) return;

  const drafts = await db.getDraftsByStatus('pending');
  for (const draft of drafts) {
    await db.updateDraftStatus(draft.id, 'processing');
    try {
      const result = await ollamaService.parseTranscript(draft.transcript);
      await createItemFromOllamaResult(result);
      await db.deleteDraft(draft.id);
    } catch {
      await db.updateDraftStatus(draft.id, 'failed');
    }
  }
}

// Manual fallback: Tap DraftBanner → see list of transcripts
// → user can tap "Add as Todo" / "Add as Reminder" / "Save as Thought"
```

---

## Implementation Phases

### Phase 1 — Foundation (Day 1)
- `npx create-expo-app VoiceTaskApp --template blank-typescript`
- Install all dependencies
- Set up navigation (4-tab bottom nav with placeholder screens)
- Define TypeScript types in `src/types/index.ts`
- Initialize SQLite with schema in `src/services/db.ts`
- Set up Zustand stores (empty)

### Phase 2 — Storage Layer (Day 1-2)
- Implement all CRUD functions in `db.ts` (create, read, update, delete for all 4 tables)
- Wire Zustand stores to SQLite (load on app start, write on mutations)
- Verify data persists across app restarts

### Phase 3 — UI Skeleton (Day 2-3)
- Build all 4 screens with mock/hardcoded data
- Style with NativeWind
- TodoItem, ReminderCard, ThoughtCard components
- Swipe-to-delete, swipe-to-complete interactions
- Bottom InputBar (text-only mode for now)

### Phase 4 — Text Input Pipeline (Day 3)
- Text input → hardcoded item type selection (dropdown: Todo / Reminder / Thought)
- For Reminders: DateTimePicker to set datetime
- Create items in SQLite, update UI

### Phase 5 — Push Notifications (Day 4)
- Request permissions on app start
- `notificationService.ts` with schedule/cancel
- Wire to Reminder create/delete/complete

### Phase 6 — Whisper Integration (Day 4-5)
- Install `whisper.rn`, download base model (~150MB)
- Settings screen: model size selector + download with progress
- `expo-av` audio recording: hold-to-record, save to temp file
- `whisperService.ts`: transcribe temp file → return text
- Show transcript to user before sending to Ollama

### Phase 7 — Ollama Integration (Day 5-6)
- Settings screen: Ollama URL + model + test connection
- `ollamaService.ts`: POST transcript with system prompt, parse JSON response
- Full pipeline: voice → Whisper → Ollama → create correct item type
- Handle Ollama errors and malformed JSON gracefully

### Phase 8 — Draft System (Day 6)
- Save to drafts table when Ollama unreachable
- `DraftBanner` component with retry button
- Background retry logic
- Manual fallback: tap draft → choose category

### Phase 9 — Polish (Day 7+)
- Empty states for all screens
- Loading and error states
- Animations (checkbox, swipe, recording waveform)
- Morning notification option in Settings
- App icon + splash screen
- Test on physical device (iOS + Android)

---

## Dependencies to Install

```bash
# Navigation
npx expo install @react-navigation/native @react-navigation/bottom-tabs
npx expo install react-native-screens react-native-safe-area-context

# Storage
npx expo install expo-sqlite

# Notifications
npx expo install expo-notifications expo-device

# Audio
npx expo install expo-av

# Whisper (on-device STT)
npm install whisper.rn

# HTTP
npm install axios

# State
npm install zustand

# Styling
npm install nativewind
npm install --save-dev tailwindcss

# Utils
npm install uuid
npm install @react-native-community/datetimepicker
```

---

## Privacy Guarantees

- All speech is transcribed **on-device** by Whisper — audio never leaves the phone
- All data stored in **local SQLite** — no cloud sync, no account needed
- Ollama runs on **your own PC** on local WiFi — no data sent to OpenAI or any API
- App works **fully offline** for transcription; only needs local network for LLM parsing
- Drafts queue means you never lose captured voice notes

---

## Future Ideas (not in initial build)

- Export todos/reminders to calendar (expo-calendar)
- Siri/Google Assistant integration trigger
- Recurring todos (daily habits)
- Tag thoughts with `#tags` for filtering
- Weekly review screen: completed todos + thoughts summary
- Backup/restore via iCloud or Google Drive
- Apple Watch / Wear OS companion for quick capture
