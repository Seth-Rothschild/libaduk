<script>
	import { goto } from '$app/navigation';
	import GameSetupModal from '$lib/GameSetupModal.svelte';
	import { pingState } from '$lib/ping.svelte.js';

	let { data } = $props();
	const username = $derived(data.user?.username ?? '');

	function formatTime(createdAt) {
		const now = Date.now();
		const diff = now - createdAt;
		const seconds = Math.floor(diff / 1000);
		const minutes = Math.floor(seconds / 60);
		const hours = Math.floor(minutes / 60);
		if (seconds < 60) return 'just now';
		if (minutes < 60) return `${minutes}m ago`;
		if (hours < 24) return `${hours}h ago`;
		return new Date(createdAt).toLocaleDateString();
	}

	function formatClock(timeControl) {
		if (!timeControl) return '∞';
		if (timeControl.type === 'correspondence') return 'Corr.';
		if (timeControl.type === 'byoyomi') return `${timeControl.initial / 60}+${timeControl.periods}×${timeControl.periodTime}s`;
		if (timeControl.type === 'fischer') return `${timeControl.initial / 60}+${timeControl.increment}`;
		return '∞';
	}

	async function createGame(pool = null) {
		if (!username) { goto('/login'); return; }
		const body = { size: 19, color: 'random' };
		if (pool) {
			body.timeControl = pool.timeControl;
		}
		const res = await fetch('/api/game', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
		const { gameId } = await res.json();
		goto(`/play/${gameId}`);
	}

	// --- Tab state and game lists ---

	let activeTab = $state('pools');
	let pendingGames = $state([]);
	let myGames = $state([]);
	let liveGames = $state([]);

	async function refreshPending() {
		const res = await fetch('/api/games');
		pendingGames = await res.json();
	}

	async function refreshMyGames() {
		if (!username) return;
		const res = await fetch(`/api/games?username=${encodeURIComponent(username)}`);
		myGames = await res.json();
	}

	async function refreshLiveGames() {
		const res = await fetch('/api/live-games');
		liveGames = await res.json();
	}

	let pollInterval = $state(null);
	let liveGamesInterval = $state(null);

	$effect(() => {
		refreshLiveGames();
		liveGamesInterval = setInterval(refreshLiveGames, 3000);
		return () => { if (liveGamesInterval) clearInterval(liveGamesInterval); };
	});

	function startPolling(fn) {
		stopPolling();
		fn();
		pollInterval = setInterval(fn, 3000);
	}

	function stopPolling() {
		if (pollInterval) {
			clearInterval(pollInterval);
			pollInterval = null;
		}
	}

	function switchTab(tab) {
		activeTab = tab;
		if (tab === 'lobby') startPolling(refreshPending);
		else if (tab === 'now_playing') startPolling(refreshMyGames);
		else stopPolling();
	}

	const LIVE_POOLS = [
		{ clock: '1+3×20s',  label: 'Bullet',     timeControl: { type: 'byoyomi', initial: 60,   periods: 3, periodTime: 20 } },
		{ clock: '3+3×20s',  label: 'Bullet',     timeControl: { type: 'byoyomi', initial: 180,  periods: 3, periodTime: 20 } },
		{ clock: '5+3×20s',  label: 'Blitz',     timeControl: { type: 'byoyomi', initial: 300,  periods: 3, periodTime: 20 } },
		{ clock: '10+3×20s', label: 'Blitz',     timeControl: { type: 'byoyomi', initial: 600,  periods: 3, periodTime: 20 } },
		{ clock: '20+3×30s', label: 'Rapid',     timeControl: { type: 'byoyomi', initial: 1200, periods: 3, periodTime: 30 } },
		{ clock: '30+5×30s', label: 'Rapid',     timeControl: { type: 'byoyomi', initial: 1800, periods: 5, periodTime: 30 } },
		{ clock: '40+0',     label: 'Standard',  timeControl: { type: 'fischer', initial: 40,   increment: 0 } },
		{ clock: '60+5×60s', label: 'Classical', timeControl: { type: 'byoyomi', initial: 3600, periods: 5, periodTime: 60 } },
	];

	let setupModal = $state(null); // 'hook' | 'friend' | null

	const CORR_POOLS = [
		{ clock: '1 day',   label: 'Correspondence', timeControl: { type: 'correspondence', days: 1 } },
		{ clock: '3 days',  label: 'Correspondence', timeControl: { type: 'correspondence', days: 3 } },
		{ clock: '7 days',  label: 'Correspondence', timeControl: { type: 'correspondence', days: 7 } },
		{ clock: '14 days', label: 'Correspondence', timeControl: { type: 'correspondence', days: 14 } },
	];
</script>

<div class="lobby">

	<!-- Tabs + quick pairing (center) -->
	<div class="lobby__app">
		<div class="tabs-horiz">
			<button class:active={activeTab === 'pools'} onclick={() => switchTab('pools')}>
				Quick pairing
			</button>
			<button class:active={activeTab === 'lobby'} onclick={() => switchTab('lobby')}>
				Lobby
			</button>
			<button
				class:active={activeTab === 'correspondence'}
				onclick={() => switchTab('correspondence')}
			>
				Correspondence
			</button>
			<button
				class:active={activeTab === 'now_playing'}
				onclick={() => switchTab('now_playing')}
			>
				Now playing
			</button>
		</div>

		<div class="lobby__pools-wrap">
			<svg class="lobby-bg-circle" viewBox="0 0 100 100" aria-hidden="true">
				<circle class="lobby-bg-circle__ring" cx="50" cy="50" r="46" fill="none" stroke="currentColor" />
			</svg>

			{#if activeTab === 'pools'}
				<div class="lpools">
					{#each LIVE_POOLS as pool}
						<div class="lpool" role="button" tabindex="0" onclick={() => createGame(pool)} onkeydown={(e) => e.key === 'Enter' && createGame(pool)}>
							<span class="clock">{pool.clock}</span>
							<span class="perf">{pool.label}</span>
						</div>
					{/each}
					<div class="lpool lpool--custom" role="button" tabindex="0" onclick={() => username ? (setupModal = 'hook') : goto('/login')} onkeydown={(e) => e.key === 'Enter' && (username ? (setupModal = 'hook') : goto('/login'))}>
						<span class="clock">Custom</span>
					</div>
				</div>
			{:else if activeTab === 'lobby'}
				{#if pendingGames.length === 0}
					<p class="lobby__tab-empty">No open games.</p>
				{:else}
					<table class="hooks__list">
						<thead>
							<tr>
								<th>Player</th>
								<th>Posted</th>
								<th>Clock</th>
								<th>Board</th>
							</tr>
						</thead>
						<tbody>
							{#each pendingGames as game}
								<tr class="hook join" onclick={() => goto(`/play/${game.id}`)}>
									<td>{game.creator}</td>
									<td>{formatTime(game.createdAt)}</td>
									<td>{formatClock(game.timeControl)}</td>
									<td>{game.size}×{game.size}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				{/if}
			{:else if activeTab === 'correspondence'}
				<div class="lpools">
					{#each CORR_POOLS as pool}
						<div class="lpool" role="button" tabindex="0" onclick={() => createGame(pool)} onkeydown={(e) => e.key === 'Enter' && createGame(pool)}>
							<span class="clock">{pool.clock}</span>
							<span class="perf">{pool.label}</span>
						</div>
					{/each}
				</div>
			{:else}
				{#if myGames.length === 0}
					<p class="lobby__tab-empty">No games in progress.</p>
				{:else}
					<table class="hooks__list">
						<thead>
							<tr>
								<th>Opponent</th>
								<th>Clock</th>
								<th>Status</th>
							</tr>
						</thead>
						<tbody>
							{#each myGames as game}
								<tr class="hook join" onclick={() => goto(`/play/${game.id}`)}>
									<td>{game.opponent ?? 'Waiting for opponent...'}</td>
									<td>{formatClock(game.timeControl)}</td>
									<td class:your-turn={game.isMyTurn === true}>
										{#if game.timeControl?.type === 'correspondence'}
											{game.isMyTurn === true ? 'Your turn' : game.isMyTurn === false ? 'Their turn' : 'Waiting'}
										{:else}
											{game.status}
										{/if}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				{/if}
			{/if}
		</div>
	</div>

	<!-- Side panel: active games -->
	<div class="lobby__side">
		<div class="lobby__box">
			<div class="lobby__box__top">
				<span>Active games</span>
			</div>
			<div class="lobby__box__content">
				{#if liveGames.length === 0}
					<p class="lobby__side-empty">No games in progress.</p>
				{:else}
					<div class="lobby__live-list">
						{#each liveGames as game}
							<a class="lobby__live-row" href="/play/{game.id}">
								<span class="lobby__live-row__players">
									{game.black} vs {game.white ?? '?'}
								</span>
								<span class="lobby__live-row__moves">{game.moveCount} moves</span>
							</a>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</div>

	<!-- Start buttons -->
	<div class="lobby__table">

		<div class="lobby__start">

			<button
				class="button button-metal lobby__start__button lobby__start__button--hook"
				onclick={() => username ? (setupModal = 'hook') : goto('/signup')}
			>
				Create a game
			</button>
			<button
				class="button button-metal lobby__start__button lobby__start__button--friend"
				onclick={() => username ? (setupModal = 'friend') : goto('/signup')}
			>
				Challenge a friend
			</button>
			<button
				class="button button-metal lobby__start__button lobby__start__button--ai"
				onclick={() => (setupModal = 'local')}
			>
				Play locally
			</button>

			<div class="lobby__counters">
				<span class="lobby__counter">
					<strong>{pingState.lobbyStats.playersOnline}</strong> players online
				</span>
				<span class="lobby__counter">
					<strong>{pingState.lobbyStats.gamesInPlay}</strong> games in play
				</span>
			</div>
		</div>

	<!-- Stats bar -->
	</div>

	{#if setupModal}
		<GameSetupModal gameType={setupModal} onClose={() => (setupModal = null)} />
	{/if}

	<!-- About links -->
	<div class="lobby__about">
		<a href="https://github.com/Seth-Rothschild/libaduk/blob/main/README.md">About</a>
		<a href="https://github.com/Seth-Rothschild/libaduk/issues">FAQ</a>
		<a href="https://github.com/Seth-Rothschild/libaduk/issues">Contact</a>
		<a href="https://github.com/Seth-Rothschild/libaduk">Source code</a>
	</div>
</div>

<style>
	.lobby__pools-wrap {
		position: relative;
		min-height: 538px;
	}

	.lobby-bg-circle {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		opacity: 0.1;
		color: var(--c-font);
		pointer-events: none;
		z-index: 0;
	}

	.lobby-bg-circle__ring {
		stroke-width: 3;
	}

	@media (min-width: 800px) {
		.lobby-bg-circle__ring {
			stroke-width: 5;
		}
	}

	:global(.lobby__app .lpools),
	.lobby__tab-empty,
	:global(.hooks__list) {
		position: relative;
		z-index: 1;
	}

	:global(.lobby__app .lpools .clock) {
		font-size: 1.1em;
		letter-spacing: 0.05em;
	}

	:global(.lpool--custom) {
		opacity: 0.7;
	}

	.lobby__tab-empty {
		padding: 1em;
		color: var(--c-font-dim);
	}

	.lobby__counters {
		display: flex;
		gap: 1.5em;
		padding: 0.6em 1em;
		font-size: 0.9em;
		color: var(--c-font-dim);
		grid-column: 1 / -1;
	}

	.lobby__counter strong {
		color: var(--c-font);
	}

	.lobby__side-empty {
		padding: 1em;
		color: var(--c-font-dim);
		font-size: 0.9em;
	}

	.lobby__live-list {
		display: flex;
		flex-direction: column;
	}

	.lobby__live-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.5em 0.8em;
		text-decoration: none;
		color: var(--c-font);
		font-size: 0.9em;
		border-bottom: 1px solid var(--c-border);
	}

	.lobby__live-row:last-child {
		border-bottom: none;
	}

	.lobby__live-row:hover {
		background: var(--c-bg-zebra);
	}

	.lobby__live-row__moves {
		color: var(--c-font-dim);
		font-size: 0.85em;
	}
</style>
