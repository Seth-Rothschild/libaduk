const KOMI = 6.5;

export function computeScore(areaMap, size, komi = KOMI) {
  let blackArea = 0;
  let whiteArea = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const z = areaMap[y][x];
      if (z > 0) blackArea++;
      if (z < 0) whiteArea++;
    }
  }
  const blackScore = blackArea;
  const whiteScore = whiteArea + komi;
  return { blackArea, whiteArea, blackScore, whiteScore };
}

export function scoreVerdict(score) {
  if (!score) return '';
  const diff = Math.abs(score.blackScore - score.whiteScore).toFixed(1);
  if (score.blackScore > score.whiteScore) return `Black leads by ${diff}`;
  if (score.whiteScore > score.blackScore) return `White leads by ${diff}`;
  return 'Tied (jigo)';
}

export function scoreVerdictShort(score) {
  if (!score) return '';
  const diff = Math.abs(score.blackScore - score.whiteScore).toFixed(1);
  if (score.blackScore > score.whiteScore) return `B+${diff}`;
  return `W+${diff}`;
}

export function buildScoreBoard(board, deadStones) {
  const clone = board.clone();
  for (const [x, y] of deadStones) {
    const sign = clone.get([x, y]);
    if (sign === 0) continue;
    clone.set([x, y], 0);
    clone.setCaptures(-sign, (n) => n + 1);
  }
  return clone;
}

export function toggleDeadStones(board, deadStones, x, y) {
  const sign = board.get([x, y]);
  if (sign === 0) return deadStones;
  const chain = board.getChain([x, y]);
  const chainKeys = new Set(chain.map(([cx, cy]) => `${cx},${cy}`));
  const currentDeadKeys = new Set(deadStones.map(([cx, cy]) => `${cx},${cy}`));
  const isCurrentlyDead = currentDeadKeys.has(`${x},${y}`);
  if (isCurrentlyDead) {
    return deadStones.filter(([cx, cy]) => !chainKeys.has(`${cx},${cy}`));
  }
  return [...deadStones, ...chain];
}
