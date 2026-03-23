<script>
  import { goto } from '$app/navigation';
  import GameSetupModal from './GameSetupModal.svelte';
  import LobbyTabs from './LobbyTabs.svelte';
  import LobbyBackground from './LobbyBackground.svelte';
  import LobbyAbout from './LobbyAbout.svelte';
  import PoolGrid from './PoolGrid.svelte';
  import HookTable from './HookTable.svelte';
  import ActiveGamesPanel from './ActiveGamesPanel.svelte';
  import StartButtons from './StartButtons.svelte';
  import { LIVE_POOLS } from './pools.js';
  import { pingState } from '$lib/state/ping.svelte.js';
  import { getGuestId } from '$lib/state/guestId.js';

  let { data } = $props();
  const username = $derived(data.user?.username ?? '');
  const displayName = $derived(username || getGuestId());

  // --- Tab state ---

  const VALID_TABS = ['pools', 'lobby', 'correspondence'];
  const storedTab = typeof localStorage !== 'undefined' ? localStorage.getItem('lobby-tab') : null;
  let activeTab = $state(VALID_TABS.includes(storedTab) ? storedTab : 'pools');

  function switchTab(tab) {
    activeTab = tab;
    localStorage.setItem('lobby-tab', tab);
  }

  // --- Game creation ---

  async function createGame(pool = null) {
    const body = { size: pool?.size ?? 19, color: 'random', creatorName: displayName };
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

  // --- Game lists ---

  let pendingGames = $state([]);
  let myGames = $state([]);
  let liveGames = $state([]);
  let corrGames = $state([]);

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

  async function refreshCorrGames() {
    const res = await fetch('/api/games?type=correspondence');
    corrGames = await res.json();
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

  // --- Modal ---

  let setupModal = $state(null); // 'hook' | 'friend' | 'local' | null
</script>

<div class="lobby">
  <div class="lobby__app">
    <LobbyTabs {activeTab} onTabChange={switchTab} />

    <div class="lobby__pools-wrap">
      <LobbyBackground />

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

  <ActiveGamesPanel games={liveGames} />

  <div class="lobby__table">
    <StartButtons
      playersOnline={pingState.lobbyStats.playersOnline}
      gamesInPlay={pingState.lobbyStats.gamesInPlay}
      onCreateGame={() => (setupModal = 'hook')}
      onChallengeFriend={() => (setupModal = 'friend')}
      onPlayLocally={() => goto('/analysis')}
    />
  </div>

  {#if setupModal}
    <GameSetupModal
      gameType={setupModal}
      creatorName={displayName}
      onClose={() => (setupModal = null)}
    />
  {/if}

  <LobbyAbout />
</div>
