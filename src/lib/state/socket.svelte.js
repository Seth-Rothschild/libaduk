class GameSocket {
  status = $state('disconnected');

  #ws = null;
  #onMessage = null;
  #gameId = null;
  #color = null;
  #name = null;
  #ogsToken = null;
  #reconnectTimer = null;
  #reconnectDelay = 1000;
  #intentionalClose = false;

  onMessage(handler) {
    this.#onMessage = handler;
  }

  join(gameId, color = null, ogsToken = null, name = null) {
    this.#intentionalClose = false;
    this.#gameId = gameId;
    this.#color = color;
    this.#name = name;
    this.#ogsToken = ogsToken;
    this.#reconnectDelay = 1000;
    this.#openSocket();
  }

  #openSocket() {
    if (this.#ws) this.#ws.close();
    this.status = 'connecting';
    const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
    const url = `${protocol}://${location.host}/ws`;
    const ws = new WebSocket(url);
    this.#ws = ws;

    ws.addEventListener('open', () => {
      this.status = 'connected';
      this.#reconnectDelay = 1000;
      if (this.#gameId) {
        const joinMsg = { type: 'join', gameId: this.#gameId, color: this.#color };
        if (this.#name) joinMsg.name = this.#name;
        if (this.#ogsToken) joinMsg.ogsToken = this.#ogsToken;
        this.send(joinMsg);
      }
    });

    ws.addEventListener('message', (e) => {
      const msg = JSON.parse(e.data);
      this.#onMessage?.(msg);
    });

    ws.addEventListener('close', () => {
      if (this.#ws !== ws) return;
      this.#ws = null;
      if (this.#intentionalClose) {
        this.status = 'disconnected';
        return;
      }
      this.status = 'reconnecting';
      this.#scheduleReconnect();
    });

    ws.addEventListener('error', () => {
      ws.close();
    });
  }

  #scheduleReconnect() {
    clearTimeout(this.#reconnectTimer);
    this.#reconnectTimer = setTimeout(() => {
      if (this.#intentionalClose) return;
      this.#reconnectDelay = Math.min(this.#reconnectDelay * 2, 30000);
      this.#openSocket();
    }, this.#reconnectDelay);
  }

  send(msg) {
    if (this.#ws?.readyState === WebSocket.OPEN) {
      this.#ws.send(JSON.stringify(msg));
    }
  }

  leave() {
    this.#intentionalClose = true;
    clearTimeout(this.#reconnectTimer);
    this.#ws?.close();
    this.#ws = null;
    this.#gameId = null;
    this.status = 'disconnected';
  }
}

export const gameSocket = new GameSocket();
