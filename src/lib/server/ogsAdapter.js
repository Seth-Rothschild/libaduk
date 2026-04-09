// Server-side OGS WebSocket bridge — connects our game room to an OGS game,
// forwarding moves in both directions and translating OGS events to our
// standard message format so the client needs no OGS-specific code.

import { WebSocket } from 'ws';

async function fetchOgsJwt(ogsToken) {
  const res = await fetch('https://online-go.com/api/v1/ui/config/', {
    headers: { Authorization: `Bearer ${ogsToken}` }
  });
  if (!res.ok) return null;
  const config = await res.json();
  return config.user_jwt ?? null;
}

function toSgfCoord(x, y) {
  return String.fromCharCode(97 + x) + String.fromCharCode(97 + y);
}

function parseSgfCoords(sgfString) {
  if (!sgfString) return [];
  const coords = [];
  for (let i = 0; i + 1 < sgfString.length; i += 2) {
    const x = sgfString.charCodeAt(i) - 97;
    const y = sgfString.charCodeAt(i + 1) - 97;
    coords.push([x, y]);
  }
  return coords;
}

function ogsTimeToClockData(t) {
  if (!t) return null;
  const mainMs = t.thinking_time * 1000;
  return {
    mainMs,
    byoMs: t.period_time * 1000,
    byoPeriods: t.periods,
    periodMs: t.period_time * 1000,
    inByoYomi: mainMs <= 0
  };
}

function ogsClockToState(ogsClock) {
  if (!ogsClock) return null;
  const blackData = ogsTimeToClockData(ogsClock.black_time);
  const whiteData = ogsTimeToClockData(ogsClock.white_time);
  if (!blackData || !whiteData) return null;
  const activeColor = ogsClock.current_player === ogsClock.black_player_id ? 'black' : 'white';
  const serverOffset = Date.now() - (ogsClock.now ?? Date.now());
  const turnStartedAt = ogsClock.start_mode
    ? null
    : ogsClock.last_move
      ? serverOffset + ogsClock.last_move
      : null;
  return { black: blackData, white: whiteData, activeColor, turnStartedAt };
}

export class OgsAdapter {
  myColor = null;
  phase = null;

  #ogsGameId;
  #ogsUserId;
  #ogsToken;
  #onBroadcast; // (msg) => void — sends to all room clients
  #onUnicast; // (msg) => void — sends to the player who owns this game
  #onGameStart; // (myColor, blackName, whiteName) => void — called when OGS confirms game
  #onGameData;

  #ws = null;
  #pingInterval = null;
  #msgId = 1;
  #drift = 0;
  #latency = 0;
  #moveNumber = 0;
  #blackPlayerId = null;
  #whitePlayerId = null;
  #awaitingMoveConfirmation = false;
  #pendingSentChat = new Set();
  #removedStones = '';

  constructor(ogsGameId, ogsUserId, ogsToken, { onBroadcast, onUnicast, onGameStart, onGameData }) {
    this.#ogsGameId = ogsGameId;
    this.#ogsUserId = ogsUserId;
    this.#ogsToken = ogsToken;
    this.#onBroadcast = onBroadcast;
    this.#onUnicast = onUnicast;
    this.#onGameStart = onGameStart;
    this.#onGameData = onGameData;
  }

  async connect() {
    const jwt = await fetchOgsJwt(this.#ogsToken);
    if (!jwt) {
      console.error('[OgsAdapter] Failed to get OGS JWT');
      return;
    }

    const ws = new WebSocket('wss://wsp.online-go.com/');
    this.#ws = ws;

    ws.on('open', () => {
      this.#send('authenticate', { jwt });
      this.#send('game/connect', { game_id: this.#ogsGameId, chat: true });
      this.#startPing();
    });

    ws.on('message', (raw) => {
      let parsed;
      try {
        parsed = JSON.parse(raw.toString());
      } catch {
        return;
      }
      const name = parsed[0];
      const data = parsed[1];
      if (typeof name === 'number') return;
      this.#handleEvent(name, data).catch((err) => {
        console.error('[OgsAdapter] Event handler error:', err.message);
      });
    });

    ws.on('close', () => {
      this.#stopPing();
    });

    ws.on('error', (err) => {
      console.error('[OgsAdapter] WebSocket error:', err.message);
    });
  }

  async #handleEvent(name, data) {
    if (name === 'net/pong') {
      const now = Date.now();
      this.#latency = now - data.client;
      this.#drift = now - this.#latency / 2 - data.server;
      return;
    }

    const gamePrefix = `game/${this.#ogsGameId}/`;

    if (name === `${gamePrefix}gamedata`) {
      this.#onGameData(data);
      this.#blackPlayerId = data.players.black.id;
      this.#whitePlayerId = data.players.white.id;
      this.myColor = data.players.white.id === this.#ogsUserId ? 'white' : 'black';
      this.phase = data.phase;
      this.#moveNumber = data.moves?.length ?? 0;

      const blackName = data.players.black.username;
      const whiteName = data.players.white.username;
      const handicapStones = parseSgfCoords(data.initial_state?.black ?? '');
      const timeControl = data.time_control;
      timeControl.initial = timeControl.main_time;
      timeControl.periodTime = timeControl.period_time;
      timeControl.type = timeControl.system;

      const komi = data.komi ?? 6.5;

      this.#onBroadcast({ type: 'joined', color: 'black', name: blackName });
      this.#onBroadcast({ type: 'joined', color: 'white', name: whiteName });
      this.#onUnicast({ type: 'my-color', color: this.myColor, handicapStones, komi });
      this.#onGameStart(this.myColor, blackName, whiteName, handicapStones, timeControl, komi);
      if (data.phase == 'finished') {
        const winnerColor = data.winner === this.#blackPlayerId ? 'black' : 'white';
        const margin = String(data.outcome).replace(' points', '');
        const result = `${winnerColor === 'black' ? 'B' : 'W'}+${margin}`;
        this.#onBroadcast({
          type: 'gameover',
          winner: winnerColor,
          result,
          scoringDeadStones: parseSgfCoords(data.removed)
        });
      }

      if (data.clock) {
        console.log('[OgsAdapter] gamedata clock:', JSON.stringify(data.clock));
        const clockState = ogsClockToState(data.clock);
        if (clockState) this.#onBroadcast({ type: 'clock', clockState });
      }

      if (data.phase === 'stone removal') {
        this.#onBroadcast({ type: 'scoring-start' });
      }
      return;
    }

    if (name === `${gamePrefix}clock`) {
      console.log('[OgsAdapter] clock event:', JSON.stringify(data));
      const clockState = ogsClockToState(data);
      if (clockState) this.#onBroadcast({ type: 'clock', clockState });
      return;
    }

    if (name === `${gamePrefix}move`) {
      this.#moveNumber++;
      if (this.#awaitingMoveConfirmation) {
        this.#awaitingMoveConfirmation = false;
        return;
      }
      const x = data.move[0];
      const y = data.move[1];
      const isPass = x < 0 || y < 0;
      if (isPass) {
        this.#onBroadcast({ type: 'pass' });
      } else {
        this.#onBroadcast({ type: 'move', x, y });
      }
      return;
    }

    if (name === `${gamePrefix}chat`) {
      const line = data.line || data;
      const body = typeof line.body === 'string' ? line.body : JSON.stringify(line.body);
      if (line.player_id === this.#ogsUserId) return;
      const sender = line.username || 'unknown';
      this.#onBroadcast({ type: 'chat', user: sender, text: body });
      return;
    }

    if (name === `${gamePrefix}phase`) {
      const prev = this.phase;
      this.phase = data;
      if (data === 'stone removal') {
        this.#onBroadcast({ type: 'scoring-start' });
      } else if (data === 'play') {
        this.#onBroadcast({ type: 'scoring-resume' });
        this.#removedStones = '';
      } else if (data === 'finished') {
        this.#onBroadcast({ type: 'gameover' });
      }
      return;
    }

    if (name === `${gamePrefix}removed_stones_accepted`) {
      if (data.phase === 'finished') {
        const winnerColor = data.winner === this.#blackPlayerId ? 'black' : 'white';
        const margin = String(data.outcome).replace(' points', '');
        const result = `${winnerColor === 'black' ? 'B' : 'W'}+${margin}`;
        this.#onBroadcast({ type: 'gameover', winner: winnerColor, result });
      }
      return;
    }

    if (name === `${gamePrefix}removed_stones`) {
      this.#removedStones = data.all_removed || '';
      const stones = parseSgfCoords(this.#removedStones);
      this.#onBroadcast({ type: 'dead-stones', stones });
      return;
    }
  }

  sendMove(x, y) {
    this.#awaitingMoveConfirmation = true;
    this.#send('game/move', { game_id: this.#ogsGameId, move: toSgfCoord(x, y) });
  }

  sendPass() {
    this.#awaitingMoveConfirmation = true;
    this.#send('game/move', { game_id: this.#ogsGameId, move: '..' });
  }

  sendResign() {
    this.#send('game/resign', { game_id: this.#ogsGameId });
  }

  toggleDeadStone(x, y) {
    const coord = toSgfCoord(x, y);
    const isRemoved = this.#isCoordRemoved(coord);
    this.#send('game/removed_stones/set', {
      game_id: this.#ogsGameId,
      removed: !isRemoved,
      stones: coord
    });
  }

  acceptScoring() {
    this.#send('game/removed_stones/accept', {
      game_id: this.#ogsGameId,
      stones: this.#removedStones
    });
  }

  rejectScoring() {
    this.#send('game/removed_stones/reject', { game_id: this.#ogsGameId });
  }

  sendChat(text) {
    this.#pendingSentChat.add(text);
    this.#send('game/chat', {
      game_id: this.#ogsGameId,
      type: 'main',
      move_number: this.#moveNumber,
      body: text
    });
  }

  destroy() {
    this.#stopPing();
    if (this.#ws) {
      this.#ws.close();
      this.#ws = null;
    }
  }

  #isCoordRemoved(coord) {
    for (let i = 0; i + 1 < this.#removedStones.length; i += 2) {
      if (this.#removedStones.slice(i, i + 2) === coord) return true;
    }
    return false;
  }

  #send(command, payload) {
    if (this.#ws?.readyState === WebSocket.OPEN) {
      this.#ws.send(JSON.stringify([command, payload, this.#msgId++]));
    }
  }

  #startPing() {
    if (this.#pingInterval) clearInterval(this.#pingInterval);
    this.#pingInterval = setInterval(() => {
      this.#send('net/ping', { client: Date.now(), drift: this.#drift, latency: this.#latency });
    }, 10000);
  }

  #stopPing() {
    if (this.#pingInterval) {
      clearInterval(this.#pingInterval);
      this.#pingInterval = null;
    }
  }
}
