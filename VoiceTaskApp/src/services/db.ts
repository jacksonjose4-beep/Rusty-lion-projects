import * as SQLite from 'expo-sqlite';
import { Todo, Reminder, Thought, Draft } from '../types';

let db: SQLite.SQLiteDatabase;

export async function initDB(): Promise<void> {
  db = await SQLite.openDatabaseAsync('voicetask.db');

  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS todos (
      id          TEXT PRIMARY KEY,
      text        TEXT NOT NULL,
      completed   INTEGER DEFAULT 0,
      date        TEXT NOT NULL,
      priority    TEXT DEFAULT 'medium',
      created_at  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reminders (
      id              TEXT PRIMARY KEY,
      text            TEXT NOT NULL,
      scheduled_at    TEXT NOT NULL,
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
      status      TEXT DEFAULT 'pending'
    );

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

// ─── Todos ───────────────────────────────────────────────────────────────────

export async function getTodosByDate(date: string): Promise<Todo[]> {
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM todos WHERE date = ? ORDER BY created_at ASC',
    [date]
  );
  return rows.map(rowToTodo);
}

export async function createTodo(todo: Todo): Promise<void> {
  await db.runAsync(
    'INSERT INTO todos (id, text, completed, date, priority, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [todo.id, todo.text, todo.completed ? 1 : 0, todo.date, todo.priority, todo.createdAt]
  );
}

export async function updateTodoCompleted(id: string, completed: boolean): Promise<void> {
  await db.runAsync('UPDATE todos SET completed = ? WHERE id = ?', [completed ? 1 : 0, id]);
}

export async function deleteTodo(id: string): Promise<void> {
  await db.runAsync('DELETE FROM todos WHERE id = ?', [id]);
}

// ─── Reminders ───────────────────────────────────────────────────────────────

export async function getAllReminders(): Promise<Reminder[]> {
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM reminders WHERE completed = 0 ORDER BY scheduled_at ASC'
  );
  return rows.map(rowToReminder);
}

export async function createReminder(reminder: Reminder): Promise<void> {
  await db.runAsync(
    'INSERT INTO reminders (id, text, scheduled_at, recurring, notification_id, completed, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [reminder.id, reminder.text, reminder.scheduledAt, reminder.recurring, reminder.notificationId, reminder.completed ? 1 : 0, reminder.createdAt]
  );
}

export async function updateReminderNotificationId(id: string, notificationId: string): Promise<void> {
  await db.runAsync('UPDATE reminders SET notification_id = ? WHERE id = ?', [notificationId, id]);
}

export async function updateReminderCompleted(id: string, completed: boolean): Promise<void> {
  await db.runAsync('UPDATE reminders SET completed = ? WHERE id = ?', [completed ? 1 : 0, id]);
}

export async function deleteReminder(id: string): Promise<void> {
  await db.runAsync('DELETE FROM reminders WHERE id = ?', [id]);
}

// ─── Thoughts ────────────────────────────────────────────────────────────────

export async function getAllThoughts(): Promise<Thought[]> {
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM thoughts ORDER BY created_at DESC'
  );
  return rows.map(rowToThought);
}

export async function searchThoughts(query: string): Promise<Thought[]> {
  const rows = await db.getAllAsync<any>(
    "SELECT * FROM thoughts WHERE text LIKE ? ORDER BY created_at DESC",
    [`%${query}%`]
  );
  return rows.map(rowToThought);
}

export async function createThought(thought: Thought): Promise<void> {
  await db.runAsync(
    'INSERT INTO thoughts (id, text, created_at, source_type) VALUES (?, ?, ?, ?)',
    [thought.id, thought.text, thought.createdAt, thought.sourceType]
  );
}

export async function deleteThought(id: string): Promise<void> {
  await db.runAsync('DELETE FROM thoughts WHERE id = ?', [id]);
}

// ─── Drafts ──────────────────────────────────────────────────────────────────

export async function getPendingDrafts(): Promise<Draft[]> {
  const rows = await db.getAllAsync<any>(
    "SELECT * FROM drafts WHERE status = 'pending' ORDER BY created_at ASC"
  );
  return rows.map(rowToDraft);
}

export async function createDraft(draft: Draft): Promise<void> {
  await db.runAsync(
    'INSERT INTO drafts (id, transcript, created_at, status) VALUES (?, ?, ?, ?)',
    [draft.id, draft.transcript, draft.createdAt, draft.status]
  );
}

export async function updateDraftStatus(id: string, status: Draft['status']): Promise<void> {
  await db.runAsync('UPDATE drafts SET status = ? WHERE id = ?', [status, id]);
}

export async function deleteDraft(id: string): Promise<void> {
  await db.runAsync('DELETE FROM drafts WHERE id = ?', [id]);
}

export async function getDraftCount(): Promise<number> {
  const row = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM drafts WHERE status = 'pending'"
  );
  return row?.count ?? 0;
}

// ─── Settings ────────────────────────────────────────────────────────────────

export async function getSetting(key: string, fallback: string): Promise<string> {
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    [key]
  );
  return row?.value ?? fallback;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await db.runAsync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, value]
  );
}

// ─── Row mappers ─────────────────────────────────────────────────────────────

function rowToTodo(row: any): Todo {
  return {
    id: row.id,
    text: row.text,
    completed: row.completed === 1,
    date: row.date,
    priority: row.priority,
    createdAt: row.created_at,
  };
}

function rowToReminder(row: any): Reminder {
  return {
    id: row.id,
    text: row.text,
    scheduledAt: row.scheduled_at,
    recurring: row.recurring,
    notificationId: row.notification_id,
    completed: row.completed === 1,
    createdAt: row.created_at,
  };
}

function rowToThought(row: any): Thought {
  return {
    id: row.id,
    text: row.text,
    createdAt: row.created_at,
    sourceType: row.source_type,
  };
}

function rowToDraft(row: any): Draft {
  return {
    id: row.id,
    transcript: row.transcript,
    createdAt: row.created_at,
    status: row.status,
  };
}
