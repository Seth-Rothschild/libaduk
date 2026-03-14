class GameSocket {
	status = $state('disconnected');
	gameId = $state(null);
	color = $state(null);
	opponent = $state(null);

	#ws = null;
	#onMessage = null;

	onMessage(handler) {
		this.#onMessage = handler;
	}

	connect(joinMsg = null) {
		if (this.#ws) this.#ws.close();
		this.status = 'connecting';
		const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
		const url = `${protocol}://${location.host}/ws`;
		this.#ws = new WebSocket(url);

		this.#ws.addEventListener('open', () => {
			this.status = 'connected';
			if (joinMsg) this.send(joinMsg);
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
			this.status = 'disconnected';
			this.#ws = null;
		});
	}

	send(msg) {
		if (this.#ws?.readyState === WebSocket.OPEN) {
			this.#ws.send(JSON.stringify(msg));
		}
	}

	disconnect() {
		this.#ws?.close();
		this.gameId = null;
		this.color = null;
		this.opponent = null;
	}
}

export const gameSocket = new GameSocket();
