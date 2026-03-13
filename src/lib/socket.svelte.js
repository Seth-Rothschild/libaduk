class GameSocket {
	status = $state('disconnected');
	gameId = $state(null);
	color = $state(null);
	size = $state(19);
	opponent = $state(null);
	blackName = $state(null);
	whiteName = $state(null);

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
				this.size = msg.size ?? 19;
				this.blackName = msg.blackName ?? null;
				this.whiteName = msg.whiteName ?? null;
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
		this.size = 19;
		this.opponent = null;
		this.blackName = null;
		this.whiteName = null;
	}
}

export const gameSocket = new GameSocket();
