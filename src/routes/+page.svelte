<script>
	import { goto } from '$app/navigation';
	import { getUsername, setUsername } from '$lib/user.svelte.js';
	import GameSetupModal from '$lib/GameSetupModal.svelte';

	const username = $derived(getUsername());
	let usernameInput = $state('');

	function submitUsername() {
		const trimmed = usernameInput.trim();
		if (trimmed.length > 0) setUsername(trimmed);
	}

	function onUsernameKeydown(e) {
		if (e.key === 'Enter') submitUsername();
	}

	async function createGame() {
		const res = await fetch('/api/game', { method: 'POST' });
		const { gameId } = await res.json();
		goto(`/play/${gameId}`);
	}

	// --- Tab state and game lists ---

	let activeTab = $state('pools');
	let pendingGames = $state([]);
	let myGames = $state([]);

	async function refreshPending() {
		const res = await fetch('/api/games');
		pendingGames = await res.json();
	}

	async function refreshMyGames() {
		if (!username) return;
		const res = await fetch(`/api/games?username=${encodeURIComponent(username)}`);
		myGames = await res.json();
	}

	let pollInterval = $state(null);

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
		{ clock: '5+0', label: 'Blitz' },
		{ clock: '5+3', label: 'Blitz' },
		{ clock: '10+0', label: 'Blitz' },
		{ clock: '15+0', label: 'Rapid' },
		{ clock: '15+5', label: 'Rapid' },
		{ clock: '20+0', label: 'Rapid' },
		{ clock: '30+0', label: 'Classical' },
		{ clock: '30+30', label: 'Classical' },
		{ clock: '60+0', label: 'Classical' },
		{ clock: '90+0', label: 'Classical' },
		{ clock: '90+30', label: 'Classical' },
		{ clock: '120+30', label: 'Classical' }
	];

	let setupModal = $state(null); // 'hook' | 'friend' | null

	const CORR_POOLS = [
		{ clock: '1 day', label: 'Correspondence' },
		{ clock: '3 days', label: 'Correspondence' },
		{ clock: '7 days', label: 'Correspondence' },
		{ clock: '14 days', label: 'Correspondence' }
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
						<div class="lpool" role="button" tabindex="0" onclick={createGame} onkeydown={(e) => e.key === 'Enter' && createGame()}>
							<span class="clock">{pool.clock}</span>
							<span class="perf">{pool.label}</span>
						</div>
					{/each}
				</div>
			{:else if activeTab === 'lobby'}
				{#if pendingGames.length === 0}
					<p class="lobby__tab-empty">No open games.</p>
				{:else}
					<div class="lobby__game-list">
						{#each pendingGames as game}
							<a class="lobby__game-row" href="/play/{game.id}">
								<span class="lobby__game-row__creator">{game.creator}</span>
								<span class="lobby__game-row__action button button-metal">Join</span>
							</a>
						{/each}
					</div>
				{/if}
			{:else if activeTab === 'correspondence'}
				<div class="lpools">
					{#each CORR_POOLS as pool}
						<div class="lpool" role="button" tabindex="0" onclick={createGame} onkeydown={(e) => e.key === 'Enter' && createGame()}>
							<span class="clock">{pool.clock}</span>
							<span class="perf">{pool.label}</span>
						</div>
					{/each}
				</div>
			{:else}
				{#if myGames.length === 0}
					<p class="lobby__tab-empty">No games in progress.</p>
				{:else}
					<div class="lobby__game-list">
						{#each myGames as game}
							<a class="lobby__game-row" href="/play/{game.id}">
								<span class="lobby__game-row__creator">
									{game.opponent ?? 'Waiting for opponent...'}
								</span>
								<span class="lobby__game-row__status">{game.status}</span>
							</a>
						{/each}
					</div>
				{/if}
			{/if}
		</div>
	</div>

	<!-- Side panel -->
	<div class="lobby__side">
		<div class="lobby__box">
			<div class="lobby__box__top">
				<span>Recent activity</span>
			</div>
			<div class="lobby__box__content">
				<p style="padding: 1em; color: var(--c-font-dim);">Nothing yet.</p>
			</div>
		</div>
	</div>

	<!-- Start buttons -->
	<div class="lobby__table">
		<div class="lobby__start">
			<button
				class="button button-metal lobby__start__button lobby__start__button--hook"
				onclick={() => (setupModal = 'hook')}
			>
				Create a game
			</button>
			<button
				class="button button-metal lobby__start__button lobby__start__button--friend"
				onclick={() => (setupModal = 'friend')}
			>
				Challenge a friend
			</button>
			<button
				class="button button-metal lobby__start__button lobby__start__button--ai"
				onclick={() => (setupModal = 'local')}
			>
				Play locally
			</button>
		</div>
	</div>

	{#if setupModal}
		<GameSetupModal gameType={setupModal} onClose={() => (setupModal = null)} />
	{/if}

	<!-- Username prompt (shown when no username set) -->
	{#if !username}
		<div class="lobby__username-prompt">
			<div class="lobby__username-prompt__inner">
				<p>Choose a username to play</p>
				<div class="lobby__username-prompt__form">
					<input
						type="text"
						class="login-username"
						placeholder="Username"
						maxlength="20"
						bind:value={usernameInput}
						onkeydown={onUsernameKeydown}
					/>
					<button class="button button-metal" onclick={submitUsername}>Play</button>
				</div>
			</div>
		</div>
	{/if}

	<!-- About links -->
	<div class="lobby__about">
		<a href="/about">About</a>
		<a href="/faq">FAQ</a>
		<a href="/contact">Contact</a>
		<a href="/source">Source code</a>
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
	.lobby__game-list {
		position: relative;
		z-index: 1;
	}

	.lobby__tab-empty {
		padding: 1em;
		color: var(--c-font-dim);
	}

	.lobby__game-list {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 9px;
	}

	.lobby__game-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.6em 0.8em;
		background: var(--c-bg-box);
		border-radius: var(--box-radius-size);
		text-decoration: none;
		color: var(--c-font);
	}

	.lobby__game-row:hover {
		background: var(--c-bg-zebra);
	}

	.lobby__game-row__status {
		font-size: 0.85em;
		color: var(--c-font-dim);
		text-transform: capitalize;
	}

	.lobby__username-prompt {
		grid-area: side;
		display: flex;
		align-items: flex-start;
		padding-top: 1em;
	}

	.lobby__username-prompt__inner {
		background: var(--c-bg-box);
		border-radius: var(--box-radius-size);
		padding: 1.2em 1.5em;
		width: 100%;
	}

	.lobby__username-prompt__inner p {
		margin: 0 0 0.8em;
		font-weight: bold;
	}

	.lobby__username-prompt__form {
		display: flex;
		gap: 0.5em;
	}

	.lobby__username-prompt__form input {
		flex: 1;
		min-width: 0;
	}
</style>
