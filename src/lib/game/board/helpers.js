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

const HANDICAP_POINTS = {
  9: [
    { x: 6, y: 2 },
    { x: 2, y: 6 },
    { x: 6, y: 6 },
    { x: 2, y: 2 },
    { x: 4, y: 4 },
    { x: 4, y: 2 },
    { x: 4, y: 6 },
    { x: 2, y: 4 },
    { x: 6, y: 4 }
  ],
  13: [
    { x: 9, y: 3 },
    { x: 3, y: 9 },
    { x: 9, y: 9 },
    { x: 3, y: 3 },
    { x: 6, y: 6 },
    { x: 6, y: 3 },
    { x: 6, y: 9 },
    { x: 3, y: 6 },
    { x: 9, y: 6 }
  ],
  19: [
    { x: 15, y: 3 },
    { x: 3, y: 15 },
    { x: 15, y: 15 },
    { x: 3, y: 3 },
    { x: 9, y: 9 },
    { x: 9, y: 3 },
    { x: 9, y: 15 },
    { x: 3, y: 9 },
    { x: 15, y: 9 }
  ]
};

export function handicapPoints(size, count) {
  if (count < 2) return [];
  const points = HANDICAP_POINTS[size] ?? HANDICAP_POINTS[19];
  return points.slice(0, count);
}
