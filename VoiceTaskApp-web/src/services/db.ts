import Dexie, { type Table } from 'dexie';
import { Todo, Reminder, Thought, Draft } from '../types';

// ─── Database schema ──────────────────────────────────────────────────────────

class VoiceTaskDB extends Dexie {
  todos!: Table<Todo, string>;
  reminders!: Table<Reminder, string>;
  thoughts!: Table<Thought, string>;
  drafts!: Table<Draft, string>;
  settings!: Table<{ key: string; value: string }, string>;

  constructor() {
    super('voicetask');
    this.version(1).stores({
      todos:    'id, date, createdAt',
      reminders:'id, scheduledAt, completed',
      thoughts: 'id, createdAt',
      drafts:   'id, status, createdAt',
      settings: 'key',
    });
  }
}

const db = new VoiceTaskDB();

export async function initDB(): Promise<void> {
  // Dexie opens lazily, but we open it explicitly to catch errors early
  await db.open();
}

// ─── Todos ────────────────────────────────────────────────────────────────────

export async function getTodosByDate(date: string): Promise<Todo[]> {
  return db.todos.where('date').equals(date).sortBy('createdAt');
}

export async function createTodo(todo: Todo): Promise<void> {
  await db.todos.add(todo);
}

export async function updateTodoCompleted(id: string, completed: boolean): Promise<void> {
  await db.todos.update(id, { completed });
}

export async function deleteTodo(id: string): Promise<void> {
  await db.todos.delete(id);
}

// ─── Reminders ────────────────────────────────────────────────────────────────

export async function getAllReminders(): Promise<Reminder[]> {
  const all = await db.reminders.where('completed').equals(0 as any).toArray();
  return all.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
}

export async function createReminder(reminder: Reminder): Promise<void> {
  await db.reminders.add(reminder);
}

export async function updateReminderNotificationId(id: string, notificationId: string): Promise<void> {
  await db.reminders.update(id, { notificationId });
}

export async function updateReminderCompleted(id: string, completed: boolean): Promise<void> {
  await db.reminders.update(id, { completed });
}

export async function deleteReminder(id: string): Promise<void> {
  await db.reminders.delete(id);
}

// ─── Thoughts ─────────────────────────────────────────────────────────────────

export async function getAllThoughts(): Promise<Thought[]> {
  const all = await db.thoughts.toArray();
  return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function searchThoughts(query: string): Promise<Thought[]> {
  const lower = query.toLowerCase();
  const all = await db.thoughts.toArray();
  return all
    .filter((t) => t.text.toLowerCase().includes(lower))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createThought(thought: Thought): Promise<void> {
  await db.thoughts.add(thought);
}

export async function deleteThought(id: string): Promise<void> {
  await db.thoughts.delete(id);
}

// ─── Drafts ───────────────────────────────────────────────────────────────────

export async function getPendingDrafts(): Promise<Draft[]> {
  return db.drafts.where('status').equals('pending').sortBy('createdAt');
}

export async function createDraft(draft: Draft): Promise<void> {
  await db.drafts.add(draft);
}

export async function updateDraftStatus(id: string, status: Draft['status']): Promise<void> {
  await db.drafts.update(id, { status });
}

export async function deleteDraft(id: string): Promise<void> {
  await db.drafts.delete(id);
}

export async function getDraftCount(): Promise<number> {
  return db.drafts.where('status').equals('pending').count();
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export async function getSetting(key: string, fallback: string): Promise<string> {
  const row = await db.settings.get(key);
  return row?.value ?? fallback;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await db.settings.put({ key, value });
}
