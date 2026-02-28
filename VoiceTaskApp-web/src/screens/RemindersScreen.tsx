import React, { useEffect } from 'react';
import { useRemindersStore } from '../store/useRemindersStore';
import { cancelNotification } from '../services/notificationService';
import { Reminder } from '../types';
import InputBar from '../components/InputBar';
import DraftBanner from '../components/DraftBanner';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function groupReminders(reminders: Reminder[]): [string, Reminder[]][] {
  const now     = new Date();
  const weekMs  = 7 * 24 * 60 * 60 * 1000;
  const monthMs = 30 * 24 * 60 * 60 * 1000;

  const groups: Record<string, Reminder[]> = {
    Today: [], 'This Week': [], 'This Month': [], Later: [],
  };

  for (const r of reminders) {
    const d    = new Date(r.scheduledAt);
    const diff = d.getTime() - now.getTime();
    if (d.toDateString() === now.toDateString()) groups['Today'].push(r);
    else if (diff < weekMs)  groups['This Week'].push(r);
    else if (diff < monthMs) groups['This Month'].push(r);
    else groups['Later'].push(r);
  }

  return Object.entries(groups).filter(([, items]) => items.length > 0);
}

function ReminderCard({ reminder }: { reminder: Reminder }) {
  const { completeReminder, removeReminder } = useRemindersStore();

  const handleComplete = async () => {
    if (reminder.notificationId) await cancelNotification(reminder.notificationId);
    completeReminder(reminder.id);
  };

  const handleDelete = async () => {
    if (reminder.notificationId) await cancelNotification(reminder.notificationId);
    removeReminder(reminder.id);
  };

  return (
    <div className="bg-slate-800 rounded-xl p-3.5 mb-2 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        {reminder.recurring !== 'none' && (
          <span className="inline-block bg-indigo-950 text-indigo-300 text-xs px-2 py-0.5 rounded-md mb-1.5">
            ↻ {reminder.recurring}
          </span>
        )}
        <p className="text-sm text-slate-200 leading-snug">{reminder.text}</p>
        <p className="text-xs text-slate-500 mt-1">{formatDate(reminder.scheduledAt)}</p>
      </div>
      <div className="flex gap-2 flex-shrink-0">
        <button onClick={handleComplete} className="text-green-500 text-lg px-1">✓</button>
        <button onClick={handleDelete}   className="text-slate-500 text-base px-1">✕</button>
      </div>
    </div>
  );
}

export default function RemindersScreen() {
  const { reminders, loadReminders } = useRemindersStore();

  useEffect(() => { loadReminders(); }, []);

  const sections = groupReminders(reminders);

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-slate-950">
      <DraftBanner />

      <div className="px-5 pt-4 pb-3">
        <h1 className="text-3xl font-bold text-slate-100">Reminders</h1>
        {reminders.length > 0 && (
          <p className="text-sm text-slate-500 mt-0.5">{reminders.length} upcoming</p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-2">
        {reminders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <span className="text-5xl mb-3">🔔</span>
            <p className="text-slate-500">No reminders yet.</p>
            <p className="text-xs text-slate-600 mt-1">Type below and tap "Remind"</p>
          </div>
        ) : (
          sections.map(([group, items]) => (
            <div key={group}>
              <p className="text-xs font-semibold text-indigo-400 uppercase tracking-widest mt-4 mb-1.5">
                {group}
              </p>
              {items.map((r) => <ReminderCard key={r.id} reminder={r} />)}
            </div>
          ))
        )}
      </div>

      <InputBar defaultCategory="reminder" onCreated={() => loadReminders()} />
    </div>
  );
}
