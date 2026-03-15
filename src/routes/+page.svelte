<script>
	import { goto } from '$app/navigation';
	import GameSetupModal from '$lib/GameSetupModal.svelte';
	import LobbyTabs from '$lib/LobbyTabs.svelte';
	import PoolGrid from '$lib/PoolGrid.svelte';
	import HookTable from '$lib/HookTable.svelte';
	import ActiveGamesPanel from '$lib/ActiveGamesPanel.svelte';
	import StartButtons from '$lib/StartButtons.svelte';
	import { pingState } from '$lib/ping.svelte.js';

	let { data } = $props();
	const username = $derived(data.user?.username ?? '');

	async function createGame(pool = null) {
		const body = { size: pool?.size ?? 19, color: 'random' };
		if (pool) {
			body.timeControl = pool.timeControl;
		}
		const res = await fetch('/api/game', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		});
		const { gameId } = await res.json();
		goto(`/play/${gameId}`);
	}

	// --- Tab state and game lists ---

	const VALID_TABS = ['pools', 'lobby', 'correspondence'];
	const storedTab = typeof localStorage !== 'undefined' ? localStorage.getItem('lobby-tab') : null;
	let activeTab = $state(VALID_TABS.includes(storedTab) ? storedTab : 'pools');
	let pendingGames = $state([]);
	let myGames = $state([]);
	let liveGames = $state([]);

	async function refreshPending() {
		const res = await fetch('/api/games?type=live');
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

	$effect(() => {
		refreshLiveGames();
		const id = setInterval(refreshLiveGames, 3000);
		return () => clearInterval(id);
	});

	let corrGames = $state([]);

	async function refreshCorrGames() {
		const res = await fetch('/api/games?type=correspondence');
		corrGames = await res.json();
	}

	$effect(() => {
		if (activeTab === 'lobby') {
			refreshPending();
			const id = setInterval(refreshPending, 3000);
			return () => clearInterval(id);
		} else if (activeTab === 'correspondence') {
			refreshCorrGames();
			const id = setInterval(refreshCorrGames, 3000);
			return () => clearInterval(id);
		} else if (activeTab === 'now_playing') {
			refreshMyGames();
			const id = setInterval(refreshMyGames, 3000);
			return () => clearInterval(id);
		}
	});

	function switchTab(tab) {
		activeTab = tab;
		localStorage.setItem('lobby-tab', tab);
	}

	const LIVE_POOLS = [
		{
			clock: '0+3×10s',
			label: 'Bullet',
			size: 9,
			timeControl: { type: 'byoyomi', initial: 0, periods: 3, periodTime: 10 }
		},
		{
			clock: '1+3×20s',
			label: 'Bullet',
			size: 19,
			timeControl: { type: 'byoyomi', initial: 60, periods: 3, periodTime: 20 }
		},
		{
			clock: '20+0',
			label: 'Blitz',
			size: 19,
			timeControl: { type: 'fischer', initial: 20, increment: 0 }
		},
		{
			clock: '0+3×20s',
			label: 'Blitz',
			size: 9,
			timeControl: { type: 'byoyomi', initial: 0, periods: 3, periodTime: 20 }
		},
		{
			clock: '5+0',
			label: 'Rapid',
			size: 9,
			timeControl: { type: 'fischer', initial: 5, increment: 0 }
		},
		{
			clock: '10+3×20s',
			label: 'Rapid',
			size: 19,
			timeControl: { type: 'byoyomi', initial: 600, periods: 3, periodTime: 20 }
		},
		{
			clock: '10+0',
			label: 'Standard',
			size: 9,
			timeControl: { type: 'fischer', initial: 10, increment: 0 }
		},
		{
			clock: '20+3×30s',
			label: 'Standard',
			size: 19,
			timeControl: { type: 'byoyomi', initial: 1200, periods: 3, periodTime: 30 }
		},
		{
			clock: '45+3×30s',
			label: 'Classical',
			size: 19,
			timeControl: { type: 'byoyomi', initial: 2700, periods: 3, periodTime: 30 }
		},
		{
			clock: '1 day',
			label: 'Correspondence',
			size: 19,
			timeControl: { type: 'correspondence', days: 1 }
		},
		{
			clock: '3 days',
			label: 'Correspondence',
			size: 19,
			timeControl: { type: 'correspondence', days: 3 }
		}
	];

	let setupModal = $state(null); // 'hook' | 'friend' | null
</script>

<div class="lobby">
	<!-- Tabs + quick pairing (center) -->
	<div class="lobby__app">
		<LobbyTabs {activeTab} onTabChange={switchTab} />

		<div class="lobby__pools-wrap">
			<svg class="lobby-bg-circle" viewBox="0 0 100 100" aria-hidden="true">
				<circle
					class="lobby-bg-circle__ring"
					cx="50"
					cy="50"
					r="46"
					fill="none"
					stroke="currentColor"
				/>
			</svg>

			{#if activeTab === 'pools'}
				<PoolGrid
					pools={LIVE_POOLS}
					onSelect={createGame}
					showCustom={true}
					onCustom={() => (setupModal = 'hook')}
				/>
			{:else if activeTab === 'lobby'}
				<HookTable games={pendingGames} onJoin={(id) => goto(`/play/${id}`)} />
			{:else if activeTab === 'correspondence'}
				<HookTable games={corrGames} onJoin={(id) => goto(`/play/${id}`)} />
			{/if}
		</div>
	</div>

	<!-- Side panel: active games -->
	<ActiveGamesPanel games={liveGames} />

	<!-- Start buttons -->
	<div class="lobby__table">
		<StartButtons
			playersOnline={pingState.lobbyStats.playersOnline}
			gamesInPlay={pingState.lobbyStats.gamesInPlay}
			onCreateGame={() => (setupModal = 'hook')}
			onChallengeFriend={() => (setupModal = 'friend')}
			onPlayLocally={() => (setupModal = 'local')}
		/>
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
	}

	@media (min-width: 800px) {
		.lobby__pools-wrap {
			min-height: 538px;
		}
	}

	.lobby-bg-circle {
		position: absolute;
		opacity: 0.1;
		color: var(--c-font);
		pointer-events: none;
		z-index: 0;
		width: 280px;
		height: 280px;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
	}

	.lobby-bg-circle__ring {
		stroke-width: 3;
	}

	@media (min-width: 800px) {
		.lobby-bg-circle {
			width: 100%;
			height: 100%;
			top: 0;
			left: 0;
			transform: none;
			inset: 0;
		}

		.lobby-bg-circle__ring {
			stroke-width: 5;
		}
	}

	:global(.lobby__app .lpools),
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
</style>
