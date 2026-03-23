import GoBoardLib from '@sabaki/go-board';
import { emptyShiftMap } from './helpers.js';

export function createBoard(size) {
  return GoBoardLib.fromDimensions(size);
}

function readjustShifts(shiftMap, x, y) {
  const direction = shiftMap[y]?.[x];
  if (!direction) return;
  const neighbors = [
    [[1, 5, 8], x - 1, y, [3, 7, 6]],
    [[2, 5, 6], x, y - 1, [4, 7, 8]],
    [[3, 7, 6], x + 1, y, [1, 5, 8]],
    [[4, 7, 8], x, y + 1, [2, 5, 6]]
  ];
  for (const [dirs, qx, qy, removeShifts] of neighbors) {
    if (!dirs.includes(direction)) continue;
    if (shiftMap[qy]?.[qx] && removeShifts.includes(shiftMap[qy][qx])) {
      shiftMap[qy][qx] = 0;
    }
  }
}

export function applyMove(board, sign, x, y) {
  const vertex = [x, y];
  const newBoard = board.makeMove(sign, vertex, {
    preventSuicide: true,
    preventOverwrite: true,
    preventKo: true
  });
  return newBoard;
}

export function applyMoveWithShifts(board, shiftMap, sign, x, y) {
  const vertex = [x, y];
  const prevSignMap = board.signMap;
  const newBoard = board.makeMove(sign, vertex, {
    preventSuicide: true,
    preventOverwrite: true,
    preventKo: true
  });
  const newShiftMap = shiftMap.map((row) => [...row]);
  newShiftMap[y][x] = Math.ceil(Math.random() * 8);
  readjustShifts(newShiftMap, x, y);
  for (let ry = 0; ry < newBoard.height; ry++) {
    for (let rx = 0; rx < newBoard.width; rx++) {
      if (prevSignMap[ry][rx] !== 0 && newBoard.signMap[ry][rx] === 0) {
        newShiftMap[ry][rx] = 0;
      }
    }
  }
  return { board: newBoard, shiftMap: newShiftMap };
}

export function replayMoves(moves, size) {
  let board = GoBoardLib.fromDimensions(size);
  let sign = 1;
  for (const move of moves) {
    if (move.type === 'move') {
      try {
        board = board.makeMove(sign, [move.x, move.y], {
          preventSuicide: true,
          preventOverwrite: true,
          preventKo: true
        });
      } catch {}
    }
    sign = sign === 1 ? -1 : 1;
  }
  return board;
}

export function replayMovesWithHistory(moves, size) {
  let board = GoBoardLib.fromDimensions(size);
  const boards = [board];
  const lastMoves = [null];
  let shiftMap = emptyShiftMap(size);
  const shiftMaps = [shiftMap];
  let sign = 1;

  for (const move of moves) {
    if (move.type === 'move') {
      try {
        const result = applyMoveWithShifts(board, shiftMap, sign, move.x, move.y);
        board = result.board;
        shiftMap = result.shiftMap;
      } catch {}
      boards.push(board);
      lastMoves.push([move.x, move.y]);
      shiftMaps.push(shiftMap);
    } else {
      boards.push(board);
      lastMoves.push(null);
      shiftMaps.push(shiftMap);
    }
    sign = sign === 1 ? -1 : 1;
  }

  return { board, boards, lastMoves, shiftMaps, shiftMap };
}
