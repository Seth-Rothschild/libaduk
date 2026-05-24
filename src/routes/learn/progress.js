const KEY = 'learn:progress';

export function readProgress() {
  const stored = localStorage.getItem(KEY);
  return stored ? JSON.parse(stored) : {};
}

export function completeLesson(stageId, completedCount) {
  const progress = readProgress();
  progress[stageId] = completedCount;
  localStorage.setItem(KEY, JSON.stringify(progress));
}

export function clearProgress() {
  localStorage.removeItem(KEY);
}
