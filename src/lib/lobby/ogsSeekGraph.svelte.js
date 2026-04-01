import { browser } from '$app/environment';

class OgsSeekGraph {
  challenges = $state([]);
  token = $state(null);

  #map = new Map();
  #ws = null;
  #pingInterval = null;
  #msgId = 1;
  #drift = 0;
  #latency = 0;

  async start() {
    if (!browser || this.#ws) return;

    this.token = this.#getCookie('ogs_token');
    if (!this.token) return;

    const configRes = await fetch('https://online-go.com/api/v1/ui/config/', {
      headers: { Authorization: `Bearer ${this.token}` }
    });
    if (!configRes.ok) return;
    const config = await configRes.json();
    const jwt = config.user_jwt;
    if (!jwt) return;

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
      try { msg = JSON.parse(event.data); } catch { return; }
      const name = msg[0];
      const payload = msg[1];
      if (typeof name === 'number') return;

      if (name === 'net/pong') {
        const now = Date.now();
        this.#latency = now - payload.client;
        this.#drift = now - this.#latency / 2 - payload.server;
        return;
      }

      if (name === 'seekgraph/global') {
        for (const entry of payload) {
          if (entry.delete || entry.game_started) {
            this.#map.delete(entry.challenge_id);
          } else if (!entry.ranked && entry.time_control_parameters?.speed !== 'correspondence') {
            this.#map.set(entry.challenge_id, entry);
          }
        }
        this.challenges = [...this.#map.values()];
      }
    };

    ws.onclose = () => {
      clearInterval(this.#pingInterval);
      this.#pingInterval = null;
      this.#ws = null;
    };
  }

  async acceptChallenge(challengeId) {
    const res = await fetch(`https://online-go.com/api/v1/challenges/${challengeId}/accept`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.token}` }
    });
    const data = await res.json();
    window.open(`https://online-go.com/game/${data.game}`, '_blank');
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

export function formatOgsRank(rank) {
  const r = Math.floor(rank);
  if (r < 30) return `${30 - r}k`;
  return `${r - 29}d`;
}

export function formatOgsClock(tc) {
  if (!tc) return '?';
  if (tc.system === 'byoyomi') return `${tc.main_time / 60}+${tc.periods}×${tc.period_time}s`;
  if (tc.system === 'fischer') return `${tc.initial_time / 60}+${tc.time_increment}s`;
  if (tc.system === 'simple') return `${tc.per_move}s/move`;
  if (tc.system === 'absolute') return `${tc.total_time / 60}m`;
  return tc.speed ?? '?';
}
