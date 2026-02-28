import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { Reminder } from '../types';
import * as db from '../services/db';

interface RemindersState {
  reminders: Reminder[];
  loadReminders: () => Promise<void>;
  addReminder: (text: string, scheduledAt: string, recurring?: Reminder['recurring']) => Promise<Reminder>;
  updateNotificationId: (id: string, notificationId: string) => Promise<void>;
  completeReminder: (id: string) => Promise<void>;
  removeReminder: (id: string) => Promise<void>;
}

export const useRemindersStore = create<RemindersState>((set, get) => ({
  reminders: [],

  loadReminders: async () => {
    const reminders = await db.getAllReminders();
    set({ reminders });
  },

  addReminder: async (text, scheduledAt, recurring = 'none') => {
    const reminder: Reminder = {
      id: uuidv4(),
      text,
      scheduledAt,
      recurring,
      notificationId: null,
      completed: false,
      createdAt: new Date().toISOString(),
    };
    await db.createReminder(reminder);
    set((s) => ({ reminders: [...s.reminders, reminder] }));
    return reminder;
  },

  updateNotificationId: async (id, notificationId) => {
    await db.updateReminderNotificationId(id, notificationId);
    set((s) => ({
      reminders: s.reminders.map((r) => (r.id === id ? { ...r, notificationId } : r)),
    }));
  },

  completeReminder: async (id) => {
    await db.updateReminderCompleted(id, true);
    set((s) => ({ reminders: s.reminders.filter((r) => r.id !== id) }));
  },

  removeReminder: async (id) => {
    await db.deleteReminder(id);
    set((s) => ({ reminders: s.reminders.filter((r) => r.id !== id) }));
  },
}));
