export function formatTime(createdAt, now = Date.now()) {
  const parsed = typeof createdAt === 'string' ? createdAt + 'Z' : createdAt;
  const diff = now - new Date(parsed).getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (seconds < 60) return `${seconds}s ago`;
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return new Date(createdAt).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function formatClock(timeControl) {
  if (!timeControl) return '∞';
  if (timeControl.type === 'correspondence') return 'Corr.';
  if (timeControl.type === 'byoyomi')
    return `${timeControl.initial / 60}+${timeControl.periods}×${timeControl.periodTime}s`;
  if (timeControl.type === 'fischer') return `${timeControl.initial / 60}+${timeControl.increment}`;
  return '∞';
}
