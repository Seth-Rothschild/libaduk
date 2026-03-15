import { describe, it, expect, vi } from 'vitest';
import { GameState } from './gameLogic.svelte.js';

// ---- Helpers -----------------------------------------------------------

function make({ isLocal = false, mySign = null, onNavigate = null } = {}) {
	const gs = new GameState({ isLocal, onNavigate });
	if (mySign !== null) gs.mySign = mySign;
	return gs;
}

function joined(overrides = {}) {
	return { type: 'joined', color: 'black', size: 19, status: 'waiting', ...overrides };
}

// ---- Tests: joined (slim WS response) ----------------------------------

describe('joined', () => {
	it('sets mySign from color field', () => {
		const gs = make();
		gs.handleMessage(joined({ color: 'black' }));
		expect(gs.mySign).toBe(1);

		const gs2 = make();
		gs2.handleMessage(joined({ color: 'white' }));
		expect(gs2.mySign).toBe(-1);
	});

	it('sets status from message', () => {
		const gs = make();
		gs.handleMessage(joined({ status: 'waiting' }));
		expect(gs.status).toBe('waiting');

		const gs2 = make();
		gs2.handleMessage(joined({ status: 'playing' }));
		expect(gs2.status).toBe('playing');
	});

	it('maps finished status to gameover', () => {
		const gs = make();
		gs.handleMessage(joined({ status: 'finished' }));
		expect(gs.status).toBe('gameover');
	});

	it('does not override mySign in local mode', () => {
		const gs = new GameState({ isLocal: true });
		gs.handleMessage(joined({ color: 'white' }));
		expect(gs.mySign).toBe(1);
	});
});

// ---- Tests: opponent_joined / opponent_left ----------------------------

describe('opponent_joined', () => {
	it('sets status to playing', () => {
		const gs = make();
		gs.handleMessage(joined());
		gs.handleMessage({ type: 'opponent_joined', opponent: 'Bob' });
		expect(gs.status).toBe('playing');
	});

	it('updates clockState and corrState', () => {
		const clock = { activeColor: 'black' };
		const corrState = { activeColor: 'black', turnDeadline: 1234 };
		const gs = make();
		gs.handleMessage(joined());
		gs.handleMessage({ type: 'opponent_joined', clock, corrState });
		expect(gs.clockState).toEqual(clock);
		expect(gs.corrState).toEqual(corrState);
	});
});

describe('opponent_left', () => {
	it('sets status to abandoned when playing', () => {
		const gs = make();
		gs.handleMessage(joined({ status: 'playing', opponent: 'Bob' }));
		gs.handleMessage({ type: 'opponent_left' });
		expect(gs.status).toBe('abandoned');
	});

	it('does not change status when game is already over', () => {
		const gs = make();
		gs.handleMessage(joined({ status: 'finished', winner: 'black', result: 'B+R' }));
		gs.handleMessage({ type: 'opponent_left' });
		expect(gs.status).toBe('gameover');
	});
});

// ---- Tests: move -------------------------------------------------------

describe('move', () => {
	it('applies move with opponent sign and flips currentSign', () => {
		const gs = make({ mySign: 1 });
		gs.handleMessage(joined({ status: 'playing' }));
		const before = gs.currentSign;
		gs.handleMessage({ type: 'move', x: 3, y: 3 });
		expect(gs.board.signMap[3][3]).toBe(-1); // opponent is white (-1)
		expect(gs.currentSign).not.toBe(before);
		expect(gs.lastMove).toEqual([3, 3]);
		expect(gs.consecutivePasses).toBe(0);
	});

	it('applies move with black sign when mySign is -1', () => {
		const gs = make({ mySign: -1 });
		gs.handleMessage(joined({ status: 'playing', color: 'white' }));
		gs.handleMessage({ type: 'move', x: 2, y: 2 });
		expect(gs.board.signMap[2][2]).toBe(1); // opponent is black (1)
	});

	it('updates clockState from move message', () => {
		const gs = make({ mySign: 1 });
		gs.handleMessage(joined({ status: 'playing' }));
		const clock = { activeColor: 'white' };
		gs.handleMessage({ type: 'move', x: 0, y: 0, clock });
		expect(gs.clockState).toEqual(clock);
	});

	it('skips move if mySign is not yet set', () => {
		const gs = make(); // mySign stays null
		// joined sets mySign from color, but we skip joined here to test the race
		gs.handleMessage({ type: 'move', x: 3, y: 3 });
		// board unchanged (no move applied when mySign unknown)
		expect(gs.board.signMap[3][3]).toBe(0);
	});
});

// ---- Tests: pass -------------------------------------------------------

describe('pass', () => {
	it('increments consecutivePasses and flips currentSign', () => {
		const gs = make({ mySign: 1 });
		gs.handleMessage(joined({ status: 'playing' }));
		gs.handleMessage({ type: 'pass' });
		expect(gs.consecutivePasses).toBe(1);
		expect(gs.currentSign).toBe(-1);
		expect(gs.lastMove).toBeNull();
	});

	it('updates clock and corrState', () => {
		const gs = make({ mySign: 1 });
		gs.handleMessage(joined({ status: 'playing' }));
		const clock = { activeColor: 'white' };
		gs.handleMessage({ type: 'pass', clock });
		expect(gs.clockState).toEqual(clock);
	});
});

// ---- Tests: resign / timeout -------------------------------------------

describe('resign', () => {
	it('sets gameover with mySign as winner (opponent resigned)', () => {
		const gs = make({ mySign: 1 });
		gs.handleMessage(joined({ status: 'playing' }));
		gs.handleMessage({ type: 'resign' });
		expect(gs.status).toBe('gameover');
		expect(gs.winner).toBe(1); // mySign wins
		expect(gs.winnerResult).toBeNull();
	});

	it('works when mySign is -1', () => {
		const gs = make({ mySign: -1 });
		gs.handleMessage(joined({ status: 'playing', color: 'white' }));
		gs.handleMessage({ type: 'resign' });
		expect(gs.winner).toBe(-1);
	});
});

describe('timeout', () => {
	it('sets gameover — loser is my color means I lose', () => {
		const gs = make({ mySign: 1 }); // I am black
		gs.handleMessage(joined({ status: 'playing' }));
		gs.handleMessage({ type: 'timeout', loser: 'black' });
		expect(gs.status).toBe('gameover');
		expect(gs.winner).toBe(-1); // opponent (white) wins
		expect(gs.winnerResult).toBe('Time');
	});

	it('sets gameover — loser is opponent color means I win', () => {
		const gs = make({ mySign: 1 }); // I am black
		gs.handleMessage(joined({ status: 'playing' }));
		gs.handleMessage({ type: 'timeout', loser: 'white' });
		expect(gs.winner).toBe(1); // I (black) win
	});
});

// ---- Tests: scoring phase ----------------------------------------------

describe('score_phase', () => {
	it('sets status to scoring and resets approvals', () => {
		const gs = make({ mySign: 1 });
		gs.handleMessage(joined({ status: 'playing' }));
		gs.blackApproved = true;
		gs.whiteApproved = true;
		gs.handleMessage({ type: 'score_phase', deadStones: [[3, 3]] });
		expect(gs.status).toBe('scoring');
		expect(gs.deadStones).toEqual([[3, 3]]);
		expect(gs.blackApproved).toBe(false);
		expect(gs.whiteApproved).toBe(false);
	});
});

describe('dead_stones_update', () => {
	it('updates deadStones and resets approvals', () => {
		const gs = make({ mySign: 1 });
		gs.blackApproved = true;
		gs.handleMessage({ type: 'dead_stones_update', deadStones: [[1, 2], [3, 4]] });
		expect(gs.deadStones).toEqual([[1, 2], [3, 4]]);
		expect(gs.blackApproved).toBe(false);
	});
});

describe('approve_update', () => {
	it('sets individual approvals', () => {
		const gs = make();
		gs.handleMessage({ type: 'approve_update', blackApproved: true, whiteApproved: false });
		expect(gs.blackApproved).toBe(true);
		expect(gs.whiteApproved).toBe(false);
	});
});

describe('score_result', () => {
	it('sets finalScore, winner, and gameover status', () => {
		const gs = make({ mySign: 1 });
		gs.handleMessage({
			type: 'score_result',
			blackScore: 45,
			whiteScore: 38.5,
			winner: 'black',
			result: 'B+6.5'
		});
		expect(gs.status).toBe('gameover');
		expect(gs.finalScore).toEqual({ blackScore: 45, whiteScore: 38.5 });
		expect(gs.winner).toBe(1);
		expect(gs.winnerResult).toBe('B+6.5');
	});

	it('white winner sets winner to -1', () => {
		const gs = make();
		gs.handleMessage({
			type: 'score_result',
			blackScore: 30,
			whiteScore: 40.5,
			winner: 'white',
			result: 'W+10.5'
		});
		expect(gs.winner).toBe(-1);
	});
});

// ---- Tests: clock / corr updates ---------------------------------------

describe('clock_update', () => {
	it('updates clockState', () => {
		const gs = make();
		const clock = { activeColor: 'white', white: { mainMs: 55000 } };
		gs.handleMessage({ type: 'clock_update', clock });
		expect(gs.clockState).toEqual(clock);
	});
});

describe('corr_update', () => {
	it('updates corrState', () => {
		const gs = make();
		const corrState = { activeColor: 'white', turnDeadline: 8888 };
		gs.handleMessage({ type: 'corr_update', corrState });
		expect(gs.corrState).toEqual(corrState);
	});
});

// ---- Tests: aborted (navigation) ---------------------------------------

describe('aborted', () => {
	it('calls onNavigate with "/"', () => {
		const onNavigate = vi.fn();
		const gs = new GameState({ onNavigate });
		gs.handleMessage({ type: 'aborted' });
		expect(onNavigate).toHaveBeenCalledWith('/');
	});

	it('does not throw if onNavigate is null', () => {
		const gs = new GameState();
		expect(() => gs.handleMessage({ type: 'aborted' })).not.toThrow();
	});
});


// ---- Tests: initFromData (HTTP-first) ----------------------------------

function gameData(overrides = {}) {
	return {
		id: 'test01',
		size: 19,
		status: 'playing',
		blackName: 'Alice',
		whiteName: 'Bob',
		moves: [],
		timeControl: { type: 'none' },
		gameType: 'hook',
		winner: null,
		result: null,
		clockBlack: null,
		clockWhite: null,
		corrActiveColor: null,
		corrTurnDeadline: null,
		scoringActive: false,
		scoringDeadStones: [],
		scoringBlackApproved: false,
		scoringWhiteApproved: false,
		...overrides
	};
}

describe('initFromData', () => {
	it('sets boardSize and creates board', () => {
		const gs = make();
		gs.initFromData(gameData({ size: 9 }), 'black');
		expect(gs.boardSize).toBe(9);
		expect(gs.board.signMap).toHaveLength(9);
		expect(gs.board.signMap[0]).toHaveLength(9);
	});

	it('sets mySign from viewerColor', () => {
		const gs = make();
		gs.initFromData(gameData(), 'black');
		expect(gs.mySign).toBe(1);

		const gs2 = make();
		gs2.initFromData(gameData(), 'white');
		expect(gs2.mySign).toBe(-1);
	});

	it('sets mySign to null for spectators', () => {
		const gs = make();
		gs.initFromData(gameData(), null);
		expect(gs.mySign).toBeNull();
	});

	it('replays moves and sets currentSign', () => {
		const gs = make();
		gs.initFromData(
			gameData({
				moves: [
					{ type: 'move', x: 3, y: 3, color: 'black' },
					{ type: 'move', x: 4, y: 4, color: 'white' }
				]
			}),
			'black'
		);
		expect(gs.board.signMap[3][3]).toBe(1);
		expect(gs.board.signMap[4][4]).toBe(-1);
		expect(gs.currentSign).toBe(1);
	});

	it('sets lastMove from last move entry', () => {
		const gs = make();
		gs.initFromData(
			gameData({
				moves: [{ type: 'move', x: 5, y: 6, color: 'black' }]
			}),
			'black'
		);
		expect(gs.lastMove).toEqual([5, 6]);
	});

	it('sets status to playing', () => {
		const gs = make();
		gs.initFromData(gameData({ status: 'playing' }), 'black');
		expect(gs.status).toBe('playing');
	});

	it('sets status to waiting', () => {
		const gs = make();
		gs.initFromData(gameData({ status: 'waiting', whiteName: null }), 'black');
		expect(gs.status).toBe('waiting');
	});

	it('sets gameover for finished game with winner', () => {
		const gs = make();
		gs.initFromData(
			gameData({ status: 'finished', winner: 'black', result: 'B+3.5' }),
			'black'
		);
		expect(gs.status).toBe('gameover');
		expect(gs.winner).toBe(1);
		expect(gs.winnerResult).toBe('B+3.5');
	});

	it('sets abandoned status', () => {
		const gs = make();
		gs.initFromData(
			gameData({
				status: 'abandoned',
				size: 9,
				moves: [{ type: 'move', x: 3, y: 3, color: 'black' }]
			}),
			null
		);
		expect(gs.status).toBe('abandoned');
		expect(gs.boardSize).toBe(9);
		expect(gs.board.signMap[3][3]).toBe(1);
	});

	it('sets aborted status', () => {
		const gs = make();
		gs.initFromData(gameData({ status: 'aborted', size: 9 }), null);
		expect(gs.status).toBe('aborted');
		expect(gs.boardSize).toBe(9);
	});

	it('restores local game with moves and clock', () => {
		const gs = new GameState({ isLocal: true });
		gs.initFromData(
			gameData({
				size: 13,
				gameType: 'local',
				status: 'playing',
				moves: [
					{ type: 'move', x: 3, y: 3, color: 'black' },
					{ type: 'move', x: 4, y: 4, color: 'white' },
					{ type: 'move', x: 5, y: 5, color: 'black' }
				],
				timeControl: { type: 'byoyomi', initial: 60, periods: 3, periodTime: 30 },
				clockBlack: { mainMs: 45000, byoPeriods: 3, byoMs: 30000, inByoYomi: false },
				clockWhite: { mainMs: 55000, byoPeriods: 3, byoMs: 30000, inByoYomi: false }
			}),
			'black'
		);
		expect(gs.boardSize).toBe(13);
		expect(gs.status).toBe('playing');
		expect(gs.board.signMap[3][3]).toBe(1);
		expect(gs.board.signMap[4][4]).toBe(-1);
		expect(gs.board.signMap[5][5]).toBe(1);
		expect(gs.currentSign).toBe(-1);
		expect(gs.clockState.black.mainMs).toBe(45000);
		expect(gs.clockState.white.mainMs).toBe(55000);
		expect(gs.mySign).toBe(1);
	});

	it('restores scoring state', () => {
		const gs = make();
		gs.initFromData(
			gameData({
				status: 'playing',
				scoringActive: true,
				scoringDeadStones: [[3, 3]],
				scoringBlackApproved: true,
				scoringWhiteApproved: false
			}),
			'black'
		);
		expect(gs.status).toBe('scoring');
		expect(gs.deadStones).toEqual([[3, 3]]);
		expect(gs.blackApproved).toBe(true);
		expect(gs.whiteApproved).toBe(false);
	});

	it('sets timeControl', () => {
		const gs = make();
		gs.initFromData(
			gameData({ timeControl: { type: 'fischer', initial: 300, increment: 5 } }),
			'black'
		);
		expect(gs.timeControl).toEqual({ type: 'fischer', initial: 300, increment: 5 });
	});

	it('sets clock state from clockBlack and clockWhite', () => {
		const gs = make();
		gs.initFromData(
			gameData({
				timeControl: { type: 'byoyomi', initial: 60, periods: 3, periodTime: 30 },
				clockBlack: { mainMs: 55000, byoPeriods: 3, byoMs: 30000, inByoYomi: false },
				clockWhite: { mainMs: 60000, byoPeriods: 3, byoMs: 30000, inByoYomi: false }
			}),
			'black'
		);
		expect(gs.clockState).not.toBeNull();
		expect(gs.clockState.black.mainMs).toBe(55000);
		expect(gs.clockState.white.mainMs).toBe(60000);
	});

	it('sets correspondence state', () => {
		const gs = make();
		gs.initFromData(
			gameData({
				timeControl: { type: 'correspondence', days: 3 },
				corrActiveColor: 'white',
				corrTurnDeadline: 9999999
			}),
			'black'
		);
		expect(gs.corrState).toEqual({ activeColor: 'white', turnDeadline: 9999999 });
	});

	it('empty moves produces fresh board', () => {
		const gs = make();
		gs.initFromData(gameData({ size: 13, moves: [] }), 'black');
		expect(gs.boardSize).toBe(13);
		expect(gs.currentSign).toBe(1);
		expect(gs.board.signMap[0][0]).toBe(0);
	});

	it('slim joined message does not clobber initFromData state', () => {
		const gs = make();
		gs.initFromData(
			gameData({
				size: 9,
				timeControl: { type: 'fischer', initial: 300, increment: 5 },
				moves: [
					{ type: 'move', x: 2, y: 2, color: 'black' },
					{ type: 'move', x: 3, y: 3, color: 'white' }
				]
			}),
			'black'
		);
		expect(gs.boardSize).toBe(9);
		expect(gs.timeControl.type).toBe('fischer');
		expect(gs.board.signMap[2][2]).toBe(1);

		gs.handleMessage({ type: 'joined', gameId: 'test01', color: 'black', status: 'playing', opponent: 'Bob' });

		expect(gs.boardSize).toBe(9);
		expect(gs.timeControl.type).toBe('fischer');
		expect(gs.board.signMap[2][2]).toBe(1);
		expect(gs.board.signMap.length).toBe(9);
	});
});
