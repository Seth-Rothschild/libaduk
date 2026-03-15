const COL_LETTERS = 'ABCDEFGHJKLMNOPQRST';
const KOMI = 6.5;

export function colorName(sign) {
	if (sign === 1) return 'black';
	return 'white';
}

export function oppositeColor(color) {
	if (color === 'black') return 'white';
	return 'black';
}

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

export function formatCorrDeadline(deadline) {
	if (!deadline) return '';
	const remaining = deadline - Date.now();
	if (remaining <= 0) return 'Overdue';
	const days = Math.floor(remaining / 86400000);
	const hours = Math.floor((remaining % 86400000) / 3600000);
	if (days > 0) return `${days}d ${hours}h remaining`;
	const minutes = Math.floor((remaining % 3600000) / 60000);
	if (hours > 0) return `${hours}h ${minutes}m remaining`;
	return `${minutes}m remaining`;
}

export function formatVertex(vertex, size) {
	if (!vertex) return 'pass';
	const col = COL_LETTERS[vertex[0]];
	const row = size - vertex[1];
	return `${col}${row}`;
}

export function emptyMarkerMap(size) {
	return Array.from({ length: size }, () => new Array(size).fill(null));
}

export function emptyShiftMap(size) {
	return Array.from({ length: size }, () => new Array(size).fill(0));
}

export function computeVertexSize(containerWidth, boardSize) {
	if (containerWidth <= 0) return 24;
	return Math.floor(containerWidth / (boardSize + 0.8));
}

export function clampBoardSize(size) {
	const VALID_SIZES = [9, 13, 19];
	return VALID_SIZES.includes(size) ? size : 19;
}
