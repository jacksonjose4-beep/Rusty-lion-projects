import React, { useState } from 'react';
import { useRemindersStore } from '../store/useRemindersStore';
import { scheduleReminder } from '../services/notificationService';

interface Props {
  visible: boolean;
  text: string;
  onClose: () => void;
  onScheduled: () => void;
}

const QUICK_OPTIONS = [
  { label: 'In 1 hour',     getDate: () => new Date(Date.now() + 60 * 60 * 1000) },
  {
    label: 'Tonight 8pm',
    getDate: () => {
      const d = new Date(); d.setHours(20, 0, 0, 0);
      if (d <= new Date()) d.setDate(d.getDate() + 1);
      return d;
    },
  },
  {
    label: 'Tomorrow 9am',
    getDate: () => {
      const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return d;
    },
  },
  {
    label: 'Next Monday',
    getDate: () => {
      const d = new Date();
      const daysUntilMonday = (8 - d.getDay()) % 7 || 7;
      d.setDate(d.getDate() + daysUntilMonday); d.setHours(9, 0, 0, 0); return d;
    },
  },
];

function toDatetimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatSelected(d: Date): string {
  return d.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function ReminderModal({ visible, text, onClose, onScheduled }: Props) {
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const d = new Date(); d.setHours(d.getHours() + 1, 0, 0, 0); return d;
  });
  const [scheduling, setScheduling] = useState(false);

  const { addReminder, updateNotificationId } = useRemindersStore();

  const handleQuick = (getDate: () => Date) => setSelectedDate(getDate());

  const handleDateInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value) setSelectedDate(new Date(e.target.value));
  };

  const handleSchedule = async () => {
    if (!text.trim() || selectedDate <= new Date()) return;
    setScheduling(true);
    try {
      const reminder = await addReminder(text.trim(), selectedDate.toISOString());
      const notifId  = await scheduleReminder(reminder);
      await updateNotificationId(reminder.id, notifId);
      onScheduled();
    } finally {
      setScheduling(false);
    }
  };

  if (!visible) return null;

  const isPast = selectedDate <= new Date();

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* Sheet */}
      <div className="relative bg-slate-800 rounded-t-2xl p-5 pb-8 space-y-4 max-w-[480px] w-full mx-auto">
        {/* Handle */}
        <div className="w-10 h-1 bg-slate-500 rounded-full mx-auto mb-2" />

        <h2 className="text-xl font-bold text-slate-100">Set Reminder</h2>
        <p className="text-sm text-slate-400 italic leading-snug">"{text}"</p>

        {/* Quick options */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {QUICK_OPTIONS.map((opt) => (
            <button
              key={opt.label}
              onClick={() => handleQuick(opt.getDate)}
              className="flex-shrink-0 bg-slate-950 border border-slate-700 text-indigo-300 text-xs font-semibold px-3.5 py-2 rounded-full"
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Custom datetime input */}
        <div className="bg-slate-950 rounded-xl p-3 border border-slate-700">
          <p className="text-xs text-slate-500 mb-1">Custom date & time</p>
          <input
            type="datetime-local"
            className="w-full bg-transparent text-slate-200 text-sm outline-none"
            value={toDatetimeLocal(selectedDate)}
            onChange={handleDateInput}
            min={toDatetimeLocal(new Date())}
          />
        </div>

        {/* Summary */}
        <div className="flex justify-between items-center text-sm">
          <span className="text-slate-500">Scheduled for</span>
          <span className={isPast ? 'text-red-400' : 'text-indigo-300 font-semibold'}>
            {isPast ? 'Choose a future time' : formatSelected(selectedDate)}
          </span>
        </div>

        {/* Schedule button */}
        <button
          onClick={handleSchedule}
          disabled={isPast || scheduling}
          className={`w-full py-3.5 rounded-xl font-bold text-white text-sm transition-colors ${
            isPast || scheduling ? 'bg-slate-700' : 'bg-indigo-500 hover:bg-indigo-600'
          }`}
        >
          {scheduling ? 'Scheduling…' : 'Schedule Reminder'}
        </button>
      </div>
    </div>
  );
}
