import { describe, it, expect, vi } from 'vitest';
import GoBoardLib from '@sabaki/go-board';
import {
  colorName,
  oppositeColor,
  computeScore,
  scoreVerdict,
  scoreVerdictShort,
  buildScoreBoard,
  toggleDeadStones,
  formatCorrDeadline,
  formatVertex,
  emptyMarkerMap,
  emptyShiftMap,
  computeVertexSize,
  clampBoardSize
} from './gameUtils.js';

describe('colorName', () => {
  it('returns black for sign 1', () => {
    expect(colorName(1)).toBe('black');
  });

  it('returns white for sign -1', () => {
    expect(colorName(-1)).toBe('white');
  });
});

describe('oppositeColor', () => {
  it('returns white for black', () => {
    expect(oppositeColor('black')).toBe('white');
  });

  it('returns black for white', () => {
    expect(oppositeColor('white')).toBe('black');
  });
});

describe('computeScore', () => {
  it('counts territory for each color', () => {
    const areaMap = [
      [1, 1, -1],
      [1, 0, -1],
      [-1, -1, -1]
    ];
    const result = computeScore(areaMap, 3, 6.5);
    expect(result.blackArea).toBe(3);
    expect(result.whiteArea).toBe(5);
    expect(result.blackScore).toBe(3);
    expect(result.whiteScore).toBe(11.5);
  });

  it('handles empty board', () => {
    const areaMap = [
      [0, 0],
      [0, 0]
    ];
    const result = computeScore(areaMap, 2, 6.5);
    expect(result.blackArea).toBe(0);
    expect(result.whiteArea).toBe(0);
    expect(result.blackScore).toBe(0);
    expect(result.whiteScore).toBe(6.5);
  });

  it('uses default komi of 6.5', () => {
    const areaMap = [[1]];
    const result = computeScore(areaMap, 1);
    expect(result.whiteScore).toBe(6.5);
  });

  it('accepts custom komi', () => {
    const areaMap = [[1]];
    const result = computeScore(areaMap, 1, 0.5);
    expect(result.whiteScore).toBe(0.5);
  });
});

describe('scoreVerdict', () => {
  it('returns black leads message', () => {
    const result = scoreVerdict({ blackScore: 50, whiteScore: 40.5 });
    expect(result).toBe('Black leads by 9.5');
  });

  it('returns white leads message', () => {
    const result = scoreVerdict({ blackScore: 30, whiteScore: 36.5 });
    expect(result).toBe('White leads by 6.5');
  });

  it('returns tied for equal scores', () => {
    const result = scoreVerdict({ blackScore: 40, whiteScore: 40 });
    expect(result).toBe('Tied (jigo)');
  });

  it('returns empty string for null', () => {
    expect(scoreVerdict(null)).toBe('');
  });
});

describe('scoreVerdictShort', () => {
  it('returns B+ format for black lead', () => {
    expect(scoreVerdictShort({ blackScore: 50, whiteScore: 40.5 })).toBe('B+9.5');
  });

  it('returns W+ format for white lead', () => {
    expect(scoreVerdictShort({ blackScore: 30, whiteScore: 36.5 })).toBe('W+6.5');
  });

  it('returns empty string for null', () => {
    expect(scoreVerdictShort(null)).toBe('');
  });
});

describe('buildScoreBoard', () => {
  it('removes dead stones and credits captures', () => {
    let board = GoBoardLib.fromDimensions(5);
    board = board.makeMove(1, [2, 2]);
    const result = buildScoreBoard(board, [[2, 2]]);
    expect(result.get([2, 2])).toBe(0);
    expect(result.getCaptures(-1)).toBe(1);
  });

  it('ignores empty intersections in dead stones list', () => {
    const board = GoBoardLib.fromDimensions(5);
    const result = buildScoreBoard(board, [[0, 0]]);
    expect(result.get([0, 0])).toBe(0);
  });

  it('does not modify the original board', () => {
    let board = GoBoardLib.fromDimensions(5);
    board = board.makeMove(1, [2, 2]);
    buildScoreBoard(board, [[2, 2]]);
    expect(board.get([2, 2])).toBe(1);
  });
});

describe('toggleDeadStones', () => {
  it('adds a chain to dead stones when alive', () => {
    let board = GoBoardLib.fromDimensions(5);
    board = board.makeMove(1, [2, 2]);
    const result = toggleDeadStones(board, [], 2, 2);
    expect(result).toEqual([[2, 2]]);
  });

  it('removes a chain from dead stones when already dead', () => {
    let board = GoBoardLib.fromDimensions(5);
    board = board.makeMove(1, [2, 2]);
    const result = toggleDeadStones(board, [[2, 2]], 2, 2);
    expect(result).toEqual([]);
  });

  it('returns original list when clicking empty intersection', () => {
    const board = GoBoardLib.fromDimensions(5);
    const deadStones = [[1, 1]];
    const result = toggleDeadStones(board, deadStones, 0, 0);
    expect(result).toBe(deadStones);
  });

  it('toggles entire connected group', () => {
    let board = GoBoardLib.fromDimensions(5);
    board = board.makeMove(1, [2, 2]);
    board = board.makeMove(-1, [0, 0]);
    board = board.makeMove(1, [2, 3]);
    const result = toggleDeadStones(board, [], 2, 2);
    expect(result.length).toBe(2);
    const coords = result.map(([x, y]) => `${x},${y}`).sort();
    expect(coords).toContain('2,2');
    expect(coords).toContain('2,3');
  });
});

describe('formatCorrDeadline', () => {
  it('returns empty string for falsy input', () => {
    expect(formatCorrDeadline(null)).toBe('');
    expect(formatCorrDeadline(0)).toBe('');
    expect(formatCorrDeadline(undefined)).toBe('');
  });

  it('returns Overdue for past deadline', () => {
    expect(formatCorrDeadline(Date.now() - 1000)).toBe('Overdue');
  });

  it('shows days and hours for multi-day deadline', () => {
    const twoDaysFromNow = Date.now() + 2 * 86400000 + 3600000;
    const result = formatCorrDeadline(twoDaysFromNow);
    expect(result).toBe('2d 1h remaining');
  });

  it('shows hours and minutes when under a day', () => {
    const threeHoursFromNow = Date.now() + 3 * 3600000 + 30 * 60000;
    const result = formatCorrDeadline(threeHoursFromNow);
    expect(result).toBe('3h 30m remaining');
  });

  it('shows only minutes when under an hour', () => {
    const fifteenMinutesFromNow = Date.now() + 15 * 60000;
    const result = formatCorrDeadline(fifteenMinutesFromNow);
    expect(result).toBe('15m remaining');
  });
});

describe('formatVertex', () => {
  it('formats a vertex as column-row notation', () => {
    expect(formatVertex([0, 0], 19)).toBe('A19');
    expect(formatVertex([3, 3], 19)).toBe('D16');
  });

  it('skips I in column letters', () => {
    expect(formatVertex([8, 0], 19)).toBe('J19');
  });

  it('returns pass for null vertex', () => {
    expect(formatVertex(null, 19)).toBe('pass');
  });

  it('works with different board sizes', () => {
    expect(formatVertex([0, 0], 9)).toBe('A9');
    expect(formatVertex([8, 8], 9)).toBe('J1');
  });
});

describe('emptyMarkerMap', () => {
  it('creates a grid of nulls', () => {
    const map = emptyMarkerMap(3);
    expect(map).toEqual([
      [null, null, null],
      [null, null, null],
      [null, null, null]
    ]);
  });

  it('rows are independent arrays', () => {
    const map = emptyMarkerMap(2);
    map[0][0] = 'cross';
    expect(map[1][0]).toBeNull();
  });
});

describe('emptyShiftMap', () => {
  it('creates a grid of zeros', () => {
    const map = emptyShiftMap(2);
    expect(map).toEqual([
      [0, 0],
      [0, 0]
    ]);
  });

  it('rows are independent arrays', () => {
    const map = emptyShiftMap(2);
    map[0][0] = 5;
    expect(map[1][0]).toBe(0);
  });
});

describe('computeVertexSize', () => {
  it('returns 24 when container width is 0', () => {
    expect(computeVertexSize(0, 0, 19)).toBe(24);
  });

  it('returns 24 when container width is negative', () => {
    expect(computeVertexSize(-100, 0, 19)).toBe(24);
  });

  it('divides width by board size plus margin when no height', () => {
    const result = computeVertexSize(500, 0, 19);
    expect(result).toBe(Math.floor(500 / 19.8));
  });

  it('uses height when smaller than width', () => {
    const result = computeVertexSize(500, 300, 19);
    expect(result).toBe(Math.floor(300 / 19.8));
  });

  it('uses width when smaller than height', () => {
    const result = computeVertexSize(300, 500, 19);
    expect(result).toBe(Math.floor(300 / 19.8));
  });

  it('scales with board size', () => {
    const small = computeVertexSize(500, 0, 9);
    const large = computeVertexSize(500, 0, 19);
    expect(small).toBeGreaterThan(large);
  });
});

describe('clampBoardSize', () => {
  it('accepts valid sizes', () => {
    expect(clampBoardSize(9)).toBe(9);
    expect(clampBoardSize(13)).toBe(13);
    expect(clampBoardSize(19)).toBe(19);
  });

  it('defaults invalid sizes to 19', () => {
    expect(clampBoardSize(10)).toBe(19);
    expect(clampBoardSize(0)).toBe(19);
    expect(clampBoardSize(25)).toBe(19);
  });
});
