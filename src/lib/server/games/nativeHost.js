import { GobanEngine } from '../../goban.js';
import * as db from '../db.js';
import { idForColor, colorForId } from './gamedata.js';
import { initialPlayerTime, consumeElapsed, buildClock } from './clock.js';

const TIMEOUT_GRACE_MS = 2000;

export class NativeGame {
  #gameId;
  #emit;

  constructor(gameId, emit) {
    this.#gameId = gameId;
    this.#emit = emit;
  }

  async sendState(send) {
    const game = await db.getGame(this.#gameId);
    if (!game?.gamedata) return;
    send(`game/${this.#gameId}/gamedata`, game.gamedata);
    if (game.gamedata.clock) {
      send(`game/${this.#gameId}/clock`, game.gamedata.clock);
    }
  }

  async move(color, moveString, { allowAnyColor = false } = {}) {
    const game = await db.getGame(this.#gameId);
    const gamedata = game?.gamedata;
    if (!gamedata || game.status !== 'playing' || gamedata.phase !== 'play') return;

    const engine = new GobanEngine(gamedata);
    const moverColor = allowAnyColor ? engine.colorToMove() : color;
    if (engine.colorToMove() !== moverColor) return;

    const decoded = engine.decodeMoves(moveString)[0];
    if (!decoded) return;
    const isPass = decoded.x < 0;
    if (!isPass) {
      try {
        engine.place(decoded.x, decoded.y);
      } catch {
        return;
      }
    }

    const now = Date.now();
    const clock = this.#advanceClock(gamedata, moverColor, now);
    if (clock === 'timeout') {
      await this.#finish(game, this.#otherColor(moverColor), 'Timeout');
      return;
    }

    const packedMove = [decoded.x, decoded.y];
    await db.appendGamedataMove(this.#gameId, packedMove);
    if (clock) await db.updateGame(this.#gameId, { 'gamedata.clock': clock });

    this.#emit(`game/${this.#gameId}/move`, {
      game_id: this.#gameId,
      move_number: gamedata.moves.length + 1,
      move: packedMove
    });
    if (clock) this.#emit(`game/${this.#gameId}/clock`, clock);

    const previousMove = gamedata.moves.at(-1);
    const previousWasPass = previousMove && previousMove[0] < 0;
    if (isPass && previousWasPass) {
      await this.#enterStoneRemoval();
    }
  }

  #advanceClock(gamedata, moverColor, now) {
    const timeControl = gamedata.time_control;
    if (timeControl.system === 'none') return null;

    const previous = gamedata.clock;
    if (!previous) {
      const black = initialPlayerTime(timeControl);
      const white = initialPlayerTime(timeControl);
      const nextPlayerId = idForColor(this.#otherColor(moverColor));
      return buildClock(gamedata, nextPlayerId, black, white, now);
    }

    const elapsedSeconds = (now - previous.last_move) / 1000;
    const moverId = idForColor(moverColor);
    const moverTime =
      moverId === previous.black_player_id ? previous.black_time : previous.white_time;
    const updated = consumeElapsed(timeControl, moverTime, elapsedSeconds);
    if (updated === null) return 'timeout';

    const black = moverColor === 'black' ? updated : previous.black_time;
    const white = moverColor === 'white' ? updated : previous.white_time;
    const nextPlayerId = idForColor(this.#otherColor(moverColor));
    return buildClock(gamedata, nextPlayerId, black, white, now);
  }

  async #enterStoneRemoval() {
    await db.updateGame(this.#gameId, {
      'gamedata.phase': 'stone removal',
      'gamedata.removed': '',
      'gamedata.players.black.accepted_stones': null,
      'gamedata.players.white.accepted_stones': null
    });
    this.#emit(`game/${this.#gameId}/phase`, 'stone removal');
  }

  async setRemoved(color, stones, removed) {
    const game = await db.getGame(this.#gameId);
    const gamedata = game?.gamedata;
    if (!gamedata || gamedata.phase !== 'stone removal') return;

    const engine = new GobanEngine(gamedata);
    for (const point of engine.decodeMoves(stones)) {
      engine.setRemoved(point.x, point.y, removed);
    }
    const allRemoved = engine.getStoneRemovalString();
    await db.updateGame(this.#gameId, {
      'gamedata.removed': allRemoved,
      'gamedata.players.black.accepted_stones': null,
      'gamedata.players.white.accepted_stones': null
    });
    this.#emit(`game/${this.#gameId}/removed_stones`, {
      removed,
      stones,
      all_removed: allRemoved
    });
  }

  async acceptRemoval(color, stones) {
    const game = await db.getGame(this.#gameId);
    const gamedata = game?.gamedata;
    if (!gamedata || gamedata.phase !== 'stone removal') return;

    await db.updateGame(this.#gameId, {
      [`gamedata.players.${color}.accepted_stones`]: stones
    });

    const other = this.#otherColor(color);
    const afterWrite = await db.getGame(this.#gameId);
    const otherAccepted = afterWrite.gamedata.players[other].accepted_stones;
    const bothAccepted = otherAccepted !== null && otherAccepted !== undefined;
    if (!bothAccepted || otherAccepted !== stones) {
      this.#emit(`game/${this.#gameId}/gamedata`, afterWrite.gamedata);
      return;
    }

    const engine = new GobanEngine({ ...gamedata, removed: stones });
    const score = engine.computeScore();
    const blackTotal = score.black.total;
    const whiteTotal = score.white.total;
    const winnerColor = blackTotal > whiteTotal ? 'black' : 'white';
    const margin = Math.abs(blackTotal - whiteTotal);
    const outcome = `${margin} points`;

    await this.#finish(game, winnerColor, outcome, { removed: stones, score });
    this.#emit(`game/${this.#gameId}/removed_stones_accepted`, {
      phase: 'finished',
      winner: idForColor(winnerColor),
      outcome,
      stones,
      end_time: Math.round(Date.now() / 1000)
    });
  }

  async rejectRemoval(color) {
    const game = await db.getGame(this.#gameId);
    const gamedata = game?.gamedata;
    if (!gamedata || gamedata.phase !== 'stone removal') return;
    await db.updateGame(this.#gameId, {
      'gamedata.phase': 'play',
      'gamedata.players.black.accepted_stones': null,
      'gamedata.players.white.accepted_stones': null
    });
    this.#emit(`game/${this.#gameId}/phase`, 'play');
  }

  async resign(color) {
    const game = await db.getGame(this.#gameId);
    if (!game?.gamedata || game.status === 'finished') return;
    await this.#finish(game, this.#otherColor(color), 'Resignation');
  }

  async cancel(color) {
    const game = await db.getGame(this.#gameId);
    if (!game?.gamedata) return;
    const moveCount = game.gamedata.moves.length;
    const canCancel = game.status === 'waiting' || (game.status === 'playing' && moveCount < 2);
    if (!canCancel) return;
    await db.updateGame(this.#gameId, {
      status: 'cancelled',
      endedAt: Date.now(),
      'gamedata.phase': 'finished',
      'gamedata.outcome': 'Cancellation'
    });
    const updated = await db.getGame(this.#gameId);
    this.#emit(`game/${this.#gameId}/gamedata`, updated.gamedata);
  }

  async timedOut() {
    const game = await db.getGame(this.#gameId);
    const clock = game?.gamedata?.clock;
    if (!game || game.status !== 'playing' || !clock) return;
    if (Date.now() < clock.expiration + TIMEOUT_GRACE_MS) return;
    const loserColor = colorForId(clock.current_player);
    await this.#finish(game, this.#otherColor(loserColor), 'Timeout');
  }

  async chat(username, playerId, body, moveNumber) {
    const line = {
      chat_id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      username,
      player_id: playerId,
      body,
      date: Math.round(Date.now() / 1000),
      move_number: moveNumber ?? 0,
      channel: 'main'
    };
    await db.appendChat(this.#gameId, line);
    this.#emit(`game/${this.#gameId}/chat`, { channel: 'main', line });
  }

  async #finish(game, winnerColor, outcome, extra = {}) {
    const shortOutcome =
      outcome === 'Resignation'
        ? 'R'
        : outcome === 'Timeout'
          ? 'T'
          : outcome.replace(' points', '');
    const result = `${winnerColor === 'black' ? 'B' : 'W'}+${shortOutcome}`;
    const patch = {
      status: 'finished',
      winner: winnerColor,
      result,
      endedAt: Date.now(),
      'gamedata.phase': 'finished',
      'gamedata.winner': idForColor(winnerColor),
      'gamedata.outcome': outcome,
      'gamedata.end_time': Math.round(Date.now() / 1000)
    };
    if (extra.removed !== undefined) patch['gamedata.removed'] = extra.removed;
    if (extra.score !== undefined) patch['gamedata.score'] = extra.score;
    await db.updateGame(this.#gameId, patch);
    const updated = await db.getGame(this.#gameId);
    this.#emit(`game/${this.#gameId}/phase`, 'finished');
    this.#emit(`game/${this.#gameId}/gamedata`, updated.gamedata);
  }

  #otherColor(color) {
    return color === 'black' ? 'white' : 'black';
  }
}
