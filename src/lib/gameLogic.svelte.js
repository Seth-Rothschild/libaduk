import GoBoardLib from '@sabaki/go-board';

function emptyShiftMap(size) {
	return Array.from({ length: size }, () => new Array(size).fill(0));
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

function replayMoves(moves, size) {
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

export class GameState {
	boardSize = $state(19);
	board = $state(GoBoardLib.fromDimensions(19));
	currentSign = $state(1);
	consecutivePasses = $state(0);
	status = $state('waiting');
	lastMove = $state(null);
	winner = $state(null);
	winnerResult = $state(null);
	shiftMap = $state(emptyShiftMap(19));
	animatedVertex = $state(null);
	timeControl = $state({ type: 'none' });
	clockState = $state(null);
	corrState = $state(null);
	deadStones = $state([]);
	blackApproved = $state(false);
	whiteApproved = $state(false);
	finalScore = $state(null);
	timedOutColor = $state(null);
	mySign = $state(null);
	isLocal = false;
	onNavigate = null;

	constructor({ isLocal = false, onNavigate = null } = {}) {
		this.isLocal = isLocal;
		this.onNavigate = onNavigate;
		if (isLocal) this.mySign = 1;
	}

	applyMove(x, y, sign) {
		const vertex = [x, y];
		const prevSignMap = this.board.signMap;
		try {
			this.board = this.board.makeMove(sign, vertex, {
				preventSuicide: true,
				preventOverwrite: true,
				preventKo: true
			});
		} catch {
			return false;
		}
		this.shiftMap[y][x] = Math.ceil(Math.random() * 8);
		readjustShifts(this.shiftMap, x, y);
		for (let ry = 0; ry < this.boardSize; ry++) {
			for (let rx = 0; rx < this.boardSize; rx++) {
				if (prevSignMap[ry][rx] !== 0 && this.board.signMap[ry][rx] === 0) {
					this.shiftMap[ry][rx] = 0;
				}
			}
		}
		this.animatedVertex = vertex;
		this.lastMove = vertex;
		this.consecutivePasses = 0;
		this.currentSign = this.currentSign === 1 ? -1 : 1;
		return true;
	}

	handleMessage(msg) {
		if (msg.type === 'joined') {
			this.boardSize = msg.size ?? 19;
			this.timeControl = msg.timeControl ?? { type: 'none' };
			this.clockState = msg.clock ?? null;
			this.corrState = msg.corrState ?? null;
			this.shiftMap = emptyShiftMap(this.boardSize);
			if (!this.isLocal) {
				this.mySign = msg.color === 'black' ? 1 : -1;
			}
			if (msg.moves && msg.moves.length > 0) {
				this.board = replayMoves(msg.moves, this.boardSize);
				this.consecutivePasses = 0;
				this.currentSign = msg.moves.length % 2 === 0 ? 1 : -1;
				const lastMoveEntry = msg.moves.at(-1);
				if (lastMoveEntry?.type === 'move') this.lastMove = [lastMoveEntry.x, lastMoveEntry.y];
			} else {
				this.board = GoBoardLib.fromDimensions(this.boardSize);
			}
			if (msg.status === 'finished') {
				this.status = 'gameover';
				this.winner = msg.winner === 'black' ? 1 : msg.winner === 'white' ? -1 : null;
				this.winnerResult = msg.result ?? null;
			} else if (msg.status === 'scoring') {
				this.status = 'scoring';
				this.deadStones = msg.deadStones ?? [];
				this.blackApproved = msg.scoringApprovals?.blackApproved ?? false;
				this.whiteApproved = msg.scoringApprovals?.whiteApproved ?? false;
			} else {
				this.status = msg.status ?? (msg.local || msg.opponent ? 'playing' : 'waiting');
			}
		}
		if (msg.type === 'opponent_joined') {
			this.status = 'playing';
			if (msg.clock) this.clockState = msg.clock;
			if (msg.corrState) this.corrState = msg.corrState;
		}
		if (msg.type === 'opponent_left') {
			if (this.status !== 'gameover') this.status = 'abandoned';
		}
		if (msg.type === 'move') {
			if (this.mySign === null) return;
			const opponentSign = this.mySign === 1 ? -1 : 1;
			this.applyMove(msg.x, msg.y, opponentSign);
			if (msg.clock) this.clockState = msg.clock;
			if (msg.corrState) this.corrState = msg.corrState;
		}
		if (msg.type === 'pass') {
			this.consecutivePasses++;
			this.lastMove = null;
			this.animatedVertex = null;
			this.currentSign = this.currentSign === 1 ? -1 : 1;
			if (msg.clock) this.clockState = msg.clock;
			if (msg.corrState) this.corrState = msg.corrState;
		}
		if (msg.type === 'aborted') {
			this.onNavigate?.('/');
		}
		if (msg.type === 'resign') {
			this.status = 'gameover';
			this.winner = this.mySign;
			this.winnerResult = null;
		}
		if (msg.type === 'timeout') {
			this.status = 'gameover';
			const myColor = this.mySign === 1 ? 'black' : 'white';
			this.winner = msg.loser === myColor ? (this.mySign === 1 ? -1 : 1) : this.mySign;
			this.winnerResult = 'Time';
		}
		if (msg.type === 'score_phase') {
			this.status = 'scoring';
			this.deadStones = msg.deadStones ?? [];
			this.blackApproved = false;
			this.whiteApproved = false;
		}
		if (msg.type === 'dead_stones_update') {
			this.deadStones = msg.deadStones ?? [];
			this.blackApproved = false;
			this.whiteApproved = false;
		}
		if (msg.type === 'approve_update') {
			this.blackApproved = msg.blackApproved;
			this.whiteApproved = msg.whiteApproved;
		}
		if (msg.type === 'score_result') {
			this.finalScore = { blackScore: msg.blackScore, whiteScore: msg.whiteScore };
			this.winner = msg.winner === 'black' ? 1 : -1;
			this.winnerResult = msg.result;
			this.status = 'gameover';
		}
		if (msg.type === 'clock_update') {
			if (msg.clock) this.clockState = msg.clock;
		}
		if (msg.type === 'corr_update') {
			if (msg.corrState) this.corrState = msg.corrState;
		}
		if (msg.type === 'error') console.error('Game error:', msg.message);
	}
}
