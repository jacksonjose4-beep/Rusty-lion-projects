export function todayDate(): string {
  return new Date().toISOString().split('T')[0];
}

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function reminderGroup(iso: string): 'Today' | 'This Week' | 'This Month' | 'Later' {
  const now = new Date();
  const d = new Date(iso);
  if (d.toDateString() === now.toDateString()) return 'Today';
  const diff = d.getTime() - now.getTime();
  if (diff < 7 * 86400000) return 'This Week';
  if (diff < 30 * 86400000) return 'This Month';
  return 'Later';
}
