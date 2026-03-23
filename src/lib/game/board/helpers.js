const COL_LETTERS = 'ABCDEFGHJKLMNOPQRST';

export function colorName(sign) {
  if (sign === 1) return 'black';
  return 'white';
}

export function formatVertex(vertex, size) {
  if (!vertex) return 'pass';
  const col = COL_LETTERS[vertex[0]];
  const row = size - vertex[1];
  return `${col}${row}`;
}

export function clampBoardSize(size) {
  const VALID_SIZES = [9, 13, 19];
  return VALID_SIZES.includes(size) ? size : 19;
}

export function emptyMarkerMap(size) {
  return Array.from({ length: size }, () => new Array(size).fill(null));
}

export function emptyShiftMap(size) {
  return Array.from({ length: size }, () => new Array(size).fill(0));
}
