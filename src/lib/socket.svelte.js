class GameSocket {
  status = $state('disconnected');
  gameId = $state(null);
  color = $state(null);
  opponent = $state(null);

  #ws = null;
  #onMessage = null;
  #joinMsg = null;
  #reconnectTimer = null;
  #reconnectDelay = 1000;
  #intentionalClose = false;

  onMessage(handler) {
    this.#onMessage = handler;
  }

  connect(joinMsg = null) {
    this.#intentionalClose = false;
    this.#joinMsg = joinMsg;
    this.#reconnectDelay = 1000;
    this.#openSocket();
  }

  #openSocket() {
    if (this.#ws) this.#ws.close();
    this.status = 'connecting';
    const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
    const url = `${protocol}://${location.host}/ws`;
    this.#ws = new WebSocket(url);

    this.#ws.addEventListener('open', () => {
      this.status = 'connected';
      this.#reconnectDelay = 1000;
      if (this.#joinMsg) this.send(this.#joinMsg);
    });

    this.#ws.addEventListener('message', (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'joined') {
        this.gameId = msg.gameId;
        this.color = msg.color;
        if (msg.opponent) this.opponent = msg.opponent;
      }
      if (msg.type === 'opponent_joined') {
        this.opponent = msg.opponent;
      }
      this.#onMessage?.(msg);
    });

    this.#ws.addEventListener('close', () => {
      this.#ws = null;
      if (this.#intentionalClose) {
        this.status = 'disconnected';
        return;
      }
      this.status = 'reconnecting';
      this.#scheduleReconnect();
    });

    this.#ws.addEventListener('error', () => {
      this.#ws?.close();
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

  disconnect() {
    this.#intentionalClose = true;
    clearTimeout(this.#reconnectTimer);
    this.#ws?.close();
    this.#ws = null;
    this.#joinMsg = null;
    this.gameId = null;
    this.color = null;
    this.opponent = null;
    this.status = 'disconnected';
  }
}

export const gameSocket = new GameSocket();
