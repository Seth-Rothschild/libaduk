import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('./db.js', () => {
  const store = { games: {} };
  return {
    _store: store,
    getGame: (id) => store.games[id] ?? null,
    createGame: ({ id, size, blackName, whiteName, timeControl, komi, gameType }) => {
      const game = {
        id,
        size,
        blackName: blackName ?? null,
        whiteName: whiteName ?? null,
        gameType: gameType ?? 'hook',
        moves: [],
        status: 'waiting',
        timeControl: timeControl ?? { type: 'none' },
        komi: komi ?? 6.5,
        createdAt: Date.now(),
        endedAt: null,
        winner: null,
        result: null,
        corrActiveColor: null,
        corrTurnDeadline: null
      };
      store.games[id] = game;
      return game;
    },
    updateGame: (id, patch) => {
      if (store.games[id]) Object.assign(store.games[id], patch);
    },
    appendMove: (id, entry) => {
      if (store.games[id]) store.games[id].moves.push(entry);
    },
    getChat: () => [],
    getNote: () => ''
  };
});

import * as dbMock from './db.js';
import { loadGameData } from './gameLoader.js';

beforeEach(() => {
  const s = dbMock._store;
  for (const k of Object.keys(s.games)) delete s.games[k];
});

function makeGame(overrides = {}) {
  const defaults = {
    id: 'test01',
    size: 19,
    blackName: 'Alice',
    whiteName: 'Bob',
    status: 'playing',
    moves: [],
    timeControl: { type: 'none' },
    gameType: 'hook',
    komi: 6.5,
    createdAt: Date.now(),
    endedAt: null,
    winner: null,
    result: null,
    corrActiveColor: null,
    corrTurnDeadline: null
  };
  const game = { ...defaults, ...overrides };
  dbMock._store.games[game.id] = game;
  return game;
}

describe('loadGameData', () => {
  it('returns null for non-existent game', () => {
    const result = loadGameData('nonexistent', 'Alice');
    expect(result).toBeNull();
  });

  it('returns game data with correct board size', () => {
    makeGame({ id: 'g1', size: 9 });
    const result = loadGameData('g1', 'Alice');
    expect(result.game.size).toBe(9);
  });

  it('returns moves array', () => {
    makeGame({
      id: 'g1',
      moves: [
        { type: 'move', x: 3, y: 3, color: 'black' },
        { type: 'move', x: 4, y: 4, color: 'white' }
      ]
    });
    const result = loadGameData('g1', 'Alice');
    expect(result.game.moves).toHaveLength(2);
    expect(result.game.moves[0]).toMatchObject({ type: 'move', x: 3, y: 3 });
  });

  it('sets viewerColor to black when user is blackName', () => {
    makeGame({ id: 'g1', blackName: 'Alice', whiteName: 'Bob' });
    const result = loadGameData('g1', 'Alice');
    expect(result.viewerColor).toBe('black');
  });

  it('sets viewerColor to white when user is whiteName', () => {
    makeGame({ id: 'g1', blackName: 'Alice', whiteName: 'Bob' });
    const result = loadGameData('g1', 'Bob');
    expect(result.viewerColor).toBe('white');
  });

  it('sets viewerColor to null for spectators', () => {
    makeGame({ id: 'g1', blackName: 'Alice', whiteName: 'Bob' });
    const result = loadGameData('g1', 'Carol');
    expect(result.viewerColor).toBeNull();
  });

  it('sets viewerColor to null for anonymous users', () => {
    makeGame({ id: 'g1', blackName: 'Alice', whiteName: 'Bob' });
    const result = loadGameData('g1', null);
    expect(result.viewerColor).toBeNull();
  });

  it('returns finished game with winner and result', () => {
    makeGame({
      id: 'g1',
      status: 'finished',
      winner: 'black',
      result: 'B+3.5'
    });
    const result = loadGameData('g1', 'Alice');
    expect(result.game.status).toBe('finished');
    expect(result.game.winner).toBe('black');
    expect(result.game.result).toBe('B+3.5');
  });

  it('returns abandoned game with full state', () => {
    makeGame({
      id: 'g1',
      status: 'abandoned',
      moves: [{ type: 'move', x: 3, y: 3, color: 'black' }]
    });
    const result = loadGameData('g1', 'Carol');
    expect(result.game.status).toBe('abandoned');
    expect(result.game.moves).toHaveLength(1);
    expect(result.viewerColor).toBeNull();
  });

  it('returns time control data', () => {
    makeGame({
      id: 'g1',
      timeControl: { type: 'fischer', initial: 300, increment: 5 }
    });
    const result = loadGameData('g1', 'Alice');
    expect(result.game.timeControl).toEqual({ type: 'fischer', initial: 300, increment: 5 });
  });

  it('returns clock data for timed games', () => {
    makeGame({
      id: 'g1',
      timeControl: { type: 'byoyomi', initial: 60, periods: 3, periodTime: 30 },
      clockBlack: { mainMs: 55000, byoPeriods: 3, byoMs: 30000, inByoYomi: false },
      clockWhite: { mainMs: 60000, byoPeriods: 3, byoMs: 30000, inByoYomi: false }
    });
    const result = loadGameData('g1', 'Alice');
    expect(result.game.clockBlack).toMatchObject({ mainMs: 55000 });
    expect(result.game.clockWhite).toMatchObject({ mainMs: 60000 });
  });

  it('returns scoring state', () => {
    makeGame({
      id: 'g1',
      status: 'playing',
      scoringActive: true,
      scoringDeadStones: [
        [3, 3],
        [4, 4]
      ],
      scoringBlackApproved: true,
      scoringWhiteApproved: false
    });
    const result = loadGameData('g1', 'Alice');
    expect(result.game.scoringActive).toBe(true);
    expect(result.game.scoringDeadStones).toEqual([
      [3, 3],
      [4, 4]
    ]);
    expect(result.game.scoringBlackApproved).toBe(true);
    expect(result.game.scoringWhiteApproved).toBe(false);
  });

  it('returns correspondence state', () => {
    makeGame({
      id: 'g1',
      timeControl: { type: 'correspondence', days: 3 },
      corrActiveColor: 'white',
      corrTurnDeadline: 9999999
    });
    const result = loadGameData('g1', 'Alice');
    expect(result.game.corrActiveColor).toBe('white');
    expect(result.game.corrTurnDeadline).toBe(9999999);
  });

  it('returns player names', () => {
    makeGame({ id: 'g1', blackName: 'Alice', whiteName: 'Bob' });
    const result = loadGameData('g1', 'Carol');
    expect(result.game.blackName).toBe('Alice');
    expect(result.game.whiteName).toBe('Bob');
  });

  it('viewerColor works for waiting game with only one player', () => {
    makeGame({ id: 'g1', blackName: 'Alice', whiteName: null, status: 'waiting' });
    const result = loadGameData('g1', 'Alice');
    expect(result.viewerColor).toBe('black');
    expect(result.game.status).toBe('waiting');
  });
});
