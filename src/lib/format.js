export function formatTime(createdAt) {
  const now = Date.now();
  const diff = now - createdAt;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (seconds < 60) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return new Date(createdAt).toLocaleDateString();
}

export function formatClock(timeControl) {
  if (!timeControl) return '∞';
  if (timeControl.type === 'correspondence') return 'Corr.';
  if (timeControl.type === 'byoyomi')
    return `${timeControl.initial / 60}+${timeControl.periods}×${timeControl.periodTime}s`;
  if (timeControl.type === 'fischer') return `${timeControl.initial / 60}+${timeControl.increment}`;
  return '∞';
}
