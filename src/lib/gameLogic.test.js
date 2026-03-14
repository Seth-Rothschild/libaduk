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

// ---- Tests: joined -----------------------------------------------------

describe('joined', () => {
	it('sets boardSize and timeControl', () => {
		const gs = make();
		gs.handleMessage(joined({ size: 13, timeControl: { type: 'fischer', initial: 300, increment: 5 } }));
		expect(gs.boardSize).toBe(13);
		expect(gs.timeControl).toEqual({ type: 'fischer', initial: 300, increment: 5 });
	});

	it('sets mySign from color field', () => {
		const gs = make();
		gs.handleMessage(joined({ color: 'black' }));
		expect(gs.mySign).toBe(1);

		const gs2 = make();
		gs2.handleMessage(joined({ color: 'white' }));
		expect(gs2.mySign).toBe(-1);
	});

	it('sets status to waiting when no opponent yet', () => {
		const gs = make();
		gs.handleMessage(joined({ status: 'waiting' }));
		expect(gs.status).toBe('waiting');
	});

	it('sets status to playing when opponent present', () => {
		const gs = make();
		gs.handleMessage(joined({ status: 'playing', opponent: 'Bob' }));
		expect(gs.status).toBe('playing');
	});

	it('sets gameover for a finished game', () => {
		const gs = make();
		gs.handleMessage(
			joined({ status: 'finished', winner: 'black', result: 'B+R' })
		);
		expect(gs.status).toBe('gameover');
		expect(gs.winner).toBe(1);
		expect(gs.winnerResult).toBe('B+R');
	});

	it('finished with white winner sets winner to -1', () => {
		const gs = make();
		gs.handleMessage(joined({ status: 'finished', winner: 'white', result: 'W+R' }));
		expect(gs.winner).toBe(-1);
	});

	it('resets board and currentSign for empty game', () => {
		const gs = make();
		gs.handleMessage(joined({ size: 9 }));
		expect(gs.currentSign).toBe(1);
		expect(gs.board.signMap[0][0]).toBe(0);
	});

	it('replays moves and sets currentSign from move count', () => {
		const gs = make();
		gs.handleMessage(
			joined({
				moves: [
					{ type: 'move', x: 3, y: 3 },
					{ type: 'move', x: 4, y: 4 }
				]
			})
		);
		expect(gs.currentSign).toBe(1); // 2 moves → back to black
		expect(gs.board.signMap[3][3]).toBe(1);
		expect(gs.board.signMap[4][4]).toBe(-1);
	});

	it('sets lastMove from last move entry', () => {
		const gs = make();
		gs.handleMessage(joined({ moves: [{ type: 'move', x: 5, y: 6 }] }));
		expect(gs.lastMove).toEqual([5, 6]);
	});

	it('sets clockState and corrState from message', () => {
		const clock = { activeColor: 'black', black: { mainMs: 60000 }, white: { mainMs: 60000 } };
		const corrState = { activeColor: 'black', turnDeadline: 9999 };
		const gs = make();
		gs.handleMessage(joined({ clock, corrState }));
		expect(gs.clockState).toEqual(clock);
		expect(gs.corrState).toEqual(corrState);
	});

	it('does not override mySign in local mode', () => {
		const gs = new GameState({ isLocal: true });
		gs.handleMessage(joined({ color: 'white' }));
		expect(gs.mySign).toBe(1); // local always plays as both, mySign fixed to 1
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

// ---- Tests: reconnect via joined with scoring state --------------------

describe('joined — scoring phase reconnect', () => {
	it('restores scoring status', () => {
		const gs = make({ mySign: 1 });
		gs.handleMessage(joined({ status: 'scoring', deadStones: [] }));
		expect(gs.status).toBe('scoring');
	});

	it('restores dead stones', () => {
		const gs = make({ mySign: 1 });
		gs.handleMessage(joined({ status: 'scoring', deadStones: [[3, 3], [4, 4]] }));
		expect(gs.deadStones).toEqual([[3, 3], [4, 4]]);
	});

	it('restores approval state', () => {
		const gs = make({ mySign: 1 });
		gs.handleMessage(
			joined({
				status: 'scoring',
				deadStones: [],
				scoringApprovals: { blackApproved: true, whiteApproved: false }
			})
		);
		expect(gs.blackApproved).toBe(true);
		expect(gs.whiteApproved).toBe(false);
	});

	it('defaults missing scoringApprovals to false', () => {
		const gs = make({ mySign: 1 });
		gs.handleMessage(joined({ status: 'scoring', deadStones: [] }));
		expect(gs.blackApproved).toBe(false);
		expect(gs.whiteApproved).toBe(false);
	});
});
