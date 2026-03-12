import { browser } from '$app/environment';

class PingState {
	ping = $state(null);

	get lagRating() {
		if (!this.ping) return 0;
		if (this.ping < 150) return 4;
		if (this.ping < 300) return 3;
		if (this.ping < 500) return 2;
		return 1;
	}

	#ws = null;
	#interval = null;
	#sentAt = null;

	start() {
		if (!browser || this.#ws) return;
		const url = `ws://${location.host}/ws`;
		this.#ws = new WebSocket(url);

		this.#ws.addEventListener('open', () => {
			this.#sendPing();
			this.#interval = setInterval(() => this.#sendPing(), 5000);
		});

		this.#ws.addEventListener('message', (e) => {
			const msg = JSON.parse(e.data);
			if (msg.type === 'pong' && this.#sentAt != null) {
				this.ping = Date.now() - this.#sentAt;
			}
		});

		this.#ws.addEventListener('close', () => {
			clearInterval(this.#interval);
			this.#ws = null;
			this.ping = null;
		});
	}

	stop() {
		clearInterval(this.#interval);
		this.#ws?.close();
		this.#ws = null;
	}

	#sendPing() {
		if (this.#ws?.readyState === WebSocket.OPEN) {
			this.#sentAt = Date.now();
			this.#ws.send(JSON.stringify({ type: 'ping' }));
		}
	}
}

export const pingState = new PingState();
