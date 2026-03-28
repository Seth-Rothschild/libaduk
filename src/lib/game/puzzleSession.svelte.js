let chips = $state([]);
let autoNext = $state(false);

export function getAutoNext() {
  return autoNext;
}

export function setAutoNext(value) {
  autoNext = value;
}

export function getChips() {
  return chips;
}

export function startChip(puzzleId) {
  chips = [...chips, { id: puzzleId, result: null }];
}

export function resolveChip(puzzleId, result) {
  chips = chips.map((c) => (c.id === puzzleId ? { ...c, result } : c));
}

export function resetChips() {
  chips = [];
}
