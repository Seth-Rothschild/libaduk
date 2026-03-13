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
		if (!username) {
			goto('/login');
			return;
		}
		const body = { size: 19, color: 'random' };
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

	$effect(() => {
		refreshLiveGames();
		const id = setInterval(refreshLiveGames, 3000);
		return () => clearInterval(id);
	});

	$effect(() => {
		if (activeTab === 'lobby') {
			refreshPending();
			const id = setInterval(refreshPending, 3000);
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
			clock: '1+3×20s',
			label: 'Bullet',
			timeControl: { type: 'byoyomi', initial: 60, periods: 3, periodTime: 20 }
		},
		{
			clock: '3+3×20s',
			label: 'Bullet',
			timeControl: { type: 'byoyomi', initial: 180, periods: 3, periodTime: 20 }
		},
		{
			clock: '5+3×20s',
			label: 'Blitz',
			timeControl: { type: 'byoyomi', initial: 300, periods: 3, periodTime: 20 }
		},
		{
			clock: '10+3×20s',
			label: 'Blitz',
			timeControl: { type: 'byoyomi', initial: 600, periods: 3, periodTime: 20 }
		},
		{
			clock: '20+3×30s',
			label: 'Rapid',
			timeControl: { type: 'byoyomi', initial: 1200, periods: 3, periodTime: 30 }
		},
		{
			clock: '30+5×30s',
			label: 'Rapid',
			timeControl: { type: 'byoyomi', initial: 1800, periods: 5, periodTime: 30 }
		},
		{
			clock: '40+0',
			label: 'Standard',
			timeControl: { type: 'fischer', initial: 40, increment: 0 }
		},
		{
			clock: '60+5×60s',
			label: 'Classical',
			timeControl: { type: 'byoyomi', initial: 3600, periods: 5, periodTime: 60 }
		}
	];

	let setupModal = $state(null); // 'hook' | 'friend' | null

	const CORR_POOLS = [
		{ clock: '1 day', label: 'Correspondence', timeControl: { type: 'correspondence', days: 1 } },
		{ clock: '3 days', label: 'Correspondence', timeControl: { type: 'correspondence', days: 3 } },
		{ clock: '7 days', label: 'Correspondence', timeControl: { type: 'correspondence', days: 7 } },
		{
			clock: '14 days',
			label: 'Correspondence',
			timeControl: { type: 'correspondence', days: 14 }
		}
	];
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
					onCustom={() => (username ? (setupModal = 'hook') : goto('/login'))}
				/>
			{:else if activeTab === 'lobby'}
				<HookTable games={pendingGames} onJoin={(id) => goto(`/play/${id}`)} />
			{:else if activeTab === 'correspondence'}
				<PoolGrid pools={CORR_POOLS} onSelect={createGame} showCustom={false} />
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
			onCreateGame={() => (username ? (setupModal = 'hook') : goto('/signup'))}
			onChallengeFriend={() => (username ? (setupModal = 'friend') : goto('/signup'))}
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
