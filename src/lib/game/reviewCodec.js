import { encodeMoves, decodeMoves } from '$lib/goban.js';

function toJgofColor(sign) {
  return sign === 1 ? 1 : 2;
}

function fromJgofColor(color) {
  return color === 1 ? 1 : -1;
}

export function nodePathFromRoot(node) {
  const path = [];
  let current = node;
  while (current.parent) {
    path.unshift(current);
    current = current.parent;
  }
  return path;
}

/**
 * Every hop is encoded with `edited: true` so its color is explicit in the
 * move string. encodeMoves/decodeMoves only preserve color through the `!`
 * edited marker — a plain run assumes a fixed default first-mover with no
 * relation to our actual initial_player, so trusting alternation here would
 * silently reintroduce the exact color-loss bug this codec exists to fix.
 */
export function encodeNodePath(node) {
  const path = nodePathFromRoot(node);
  const moves = path.map((n) =>
    n.lastMove
      ? { x: n.lastMove[0], y: n.lastMove[1], color: toJgofColor(n.sign), edited: true }
      : { x: -1, y: -1, color: toJgofColor(n.sign), edited: true }
  );
  return encodeMoves(moves);
}

export function collectReviewEntries(root) {
  const entries = [];
  function walk(node) {
    if (node.parent) {
      const entry = { m: encodeNodePath(node) };
      if (node.comment) entry.t = node.comment;
      if (node.bookmark) entry.bookmark = node.bookmark;
      entries.push(entry);
    }
    for (const child of node.children) walk(child);
  }
  walk(root);
  return entries;
}

export function decodeMovePath(moveString, size) {
  return decodeMoves(moveString, size, size).map((move) => ({
    x: move.x,
    y: move.y,
    sign: fromJgofColor(move.color),
    isPass: move.x < 0
  }));
}
