import { browser } from '$app/environment';
import { getMe } from '$lib/state/user.svelte.js';

class OgsSeekGraph {
  challenges = $state([]);
  token = $state(null);
  userId = $state(null);
  tokenExpired = $state(false);

  #map = new Map();
  #ws = null;
  #pingInterval = null;
  #msgId = 1;
  #drift = 0;
  #latency = 0;
  #pendingChallengeId = null;
  #onChallengeAccepted = null;
  #keepaliveInterval = null;

  async start() {
    if (!browser || this.#ws) return;

    this.token = this.#getCookie('ogs_token');
    if (!this.token) {
      this.tokenExpired = getMe()?.ogs != null;
      return;
    }

    const configRes = await fetch('https://online-go.com/api/v1/ui/config/', {
      headers: { Authorization: `Bearer ${this.token}` }
    });
    if (!configRes.ok) {
      this.tokenExpired = true;
      return;
    }
    this.tokenExpired = false;
    const config = await configRes.json();
    if (config.user.anonymous) {
      this.tokenExpired = true;
    }
    const jwt = config.user_jwt;
    if (!jwt) return;
    this.userId = config.user?.id ?? null;

    const ws = new WebSocket('wss://wsp.online-go.com/');
    this.#ws = ws;

    ws.onopen = () => {
      this.#send('authenticate', { jwt });
      this.#send('seek_graph/connect', { channel: 'global' });
      this.#pingInterval = setInterval(() => {
        this.#send('net/ping', { client: Date.now(), drift: this.#drift, latency: this.#latency });
      }, 10000);
    };

    ws.onmessage = (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }
      const name = msg[0];
      const payload = msg[1];
      if (typeof name === 'number') return;

      if (name === 'net/pong') {
        const now = Date.now();
        this.#latency = now - payload.client;
        this.#drift = now - this.#latency / 2 - payload.server;
        return;
      }

      if (name === 'notification' && payload?.type === 'gameStarted' && this.#pendingChallengeId) {
        const gameId = payload.game_id;
        if (gameId) {
          this.#pendingChallengeId = null;
          this.#onChallengeAccepted?.(gameId);
          this.#onChallengeAccepted = null;
        }
      }

      if (name === 'seekgraph/global') {
        for (const entry of payload) {
          if (entry.delete || entry.game_started) {
            this.#map.delete(entry.challenge_id);
            if (entry.game_started && entry.challenge_id === this.#pendingChallengeId) {
              this.#pendingChallengeId = null;
              this.#onChallengeAccepted?.(entry.game_id);
              this.#onChallengeAccepted = null;
            }
          } else if (
            !entry.ranked &&
            entry.time_control_parameters?.speed !== 'correspondence' &&
            entry.min_rank <= getMe()?.ogs?.ranking &&
            getMe()?.ogs?.ranking <= entry.max_rank
          ) {
            this.#map.set(entry.challenge_id, entry);
          }
        }
        this.challenges = [...this.#map.values()].slice(0, 15);
      }
    };

    ws.onclose = () => {
      clearInterval(this.#pingInterval);
      this.#pingInterval = null;
      this.#ws = null;
    };
  }

  async createChallenge({ size, mainTime, periods, periodTime }) {
    const tcParams = {
      system: 'byoyomi',
      time_control: 'byoyomi',
      main_time: mainTime,
      periods,
      period_time: periodTime,
      pause_on_weekends: false,
      speed: 'live'
    };
    const body = {
      initialized: false,
      min_ranking: -1000,
      max_ranking: 1000,
      challenger_color: 'random',
      rengo_auto_start: 0,
      game: {
        name: 'Friendly Match',
        rules: 'chinese',
        ranked: false,
        width: size,
        height: size,
        handicap: 0,
        komi_auto: 'automatic',
        disable_analysis: false,
        initial_state: null,
        private: false,
        rengo: false,
        rengo_casual_mode: true,
        time_control: 'byoyomi',
        time_control_parameters: tcParams,
        pause_on_weekends: false
      },
      aga_ranked: false
    };
    const res = await fetch('https://online-go.com/api/v1/challenges', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) return null;
    const data = await res.json();

    this.#pendingChallengeId = data.challenge;
    this.#keepaliveInterval = setInterval(() => {
      this.#send('challenge/keepalive', { challenge_id: data.challenge, game_id: data.game });
    }, 1000);
    return new Promise((resolve) => {
      const timeout = setTimeout(() => this.cancelPendingChallenge(), 60000);
      this.#onChallengeAccepted = (gameId) => {
        clearTimeout(timeout);
        clearInterval(this.#keepaliveInterval);
        this.#keepaliveInterval = null;

        resolve(gameId);
      };
    });
  }

  async cancelPendingChallenge() {
    const challengeId = this.#pendingChallengeId;
    if (!challengeId) return;
    const res = await fetch(`https://online-go.com/api/v1/challenges/${challengeId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${this.token}` }
    });
    if (!res.ok && res.status !== 404) return;
    clearInterval(this.#keepaliveInterval);
    this.#keepaliveInterval = null;
    this.#pendingChallengeId = null;
    this.#onChallengeAccepted?.(null);
    this.#onChallengeAccepted = null;
  }

  async acceptChallenge(challengeId) {
    const res = await fetch(`https://online-go.com/api/v1/challenges/${challengeId}/accept`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.token}` }
    });
    const data = await res.json();
    return data.game ?? null;
  }

  stop() {
    clearInterval(this.#pingInterval);
    if (this.#ws) {
      this.#send('seek_graph/disconnect', { channel: 'global' });
      this.#ws.close();
      this.#ws = null;
    }
    this.#map.clear();
    this.challenges = [];
  }

  #send(command, payload) {
    if (this.#ws?.readyState === WebSocket.OPEN) {
      this.#ws.send(JSON.stringify([command, payload, this.#msgId++]));
    }
  }

  #getCookie(name) {
    const pairs = document.cookie.split(';');
    for (const pair of pairs) {
      const [key, value] = pair.trim().split('=');
      if (key === name) return decodeURIComponent(value);
    }
    return null;
  }
}

export const ogsSeekGraph = new OgsSeekGraph();

export function formatOgsRank(input) {
  if (input != null && typeof input === 'object') {
    const ranking = input.ranking ?? input.rank;
    const isPro = input.pro || input.professional;
    if (isPro) {
      const proLevel = ranking > 900 ? ranking - 1000 - 36 : ranking - 36;
      return `${Math.floor(proLevel)}p`;
    }
    return formatOgsRank(ranking);
  }

  const r = input;

  if (r > 900) {
    return `${Math.floor(r - 1000 - 36)}p`;
  }

  if (r < 30) {
    return `${Math.ceil(30 - r)}k`;
  }

  return `${Math.floor(r - 29)}d`;
}

export function formatOgsClock(tc) {
  if (!tc) return '?';
  if (tc.system === 'byoyomi') return `${tc.main_time / 60}+${tc.periods}×${tc.period_time}s`;
  if (tc.system === 'fischer') return `${tc.initial_time / 60}+${tc.time_increment}s`;
  if (tc.system === 'simple') return `${tc.per_move}s/move`;
  if (tc.system === 'absolute') return `${tc.total_time / 60}m`;
  return tc.speed ?? '?';
}
