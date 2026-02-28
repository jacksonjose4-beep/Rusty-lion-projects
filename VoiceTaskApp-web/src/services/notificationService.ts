/**
 * notificationService — Web Notifications API wrapper.
 *
 * For reminders: schedules a setTimeout to fire a browser notification
 * at the scheduled time. Works while the tab is open; for persistent
 * reminders when the tab is closed, a service worker would be needed.
 *
 * notificationId = stringified setTimeout ID so we can cancel it.
 */

import { Reminder } from '../types';

export async function requestPermissions(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

export async function scheduleReminder(reminder: Reminder): Promise<string> {
  const delay = new Date(reminder.scheduledAt).getTime() - Date.now();
  if (delay <= 0) return '';

  const timeoutId = window.setTimeout(() => {
    if (Notification.permission === 'granted') {
      new Notification('VoiceTask Reminder', {
        body: reminder.text,
        icon: '/icon-192.png',
      });
    }
  }, delay);

  return String(timeoutId);
}

export async function cancelNotification(notificationId: string): Promise<void> {
  const id = parseInt(notificationId, 10);
  if (!isNaN(id)) window.clearTimeout(id);
}
