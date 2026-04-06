<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { ogsSeekGraph } from './ogsSeekGraph.svelte.js';
  import GameSetupModal from './GameSetupModal.svelte';
  import LobbyTabs from './LobbyTabs.svelte';
  import LobbyBackground from './LobbyBackground.svelte';
  import LobbyAbout from './LobbyAbout.svelte';
  import PoolGrid from './PoolGrid.svelte';
  import HookTable from './HookTable.svelte';
  import { getMe } from '$lib/state/user.svelte.js';
  import ActiveGamesPanel from './ActiveGamesPanel.svelte';
  import StartButtons from './StartButtons.svelte';
  import LobbyPuzzle from './LobbyPuzzle.svelte';
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

  async function acceptOgsChallenge(entry) {
    const ogsGameId = await ogsSeekGraph.acceptChallenge(entry.challenge_id);
    if (!ogsGameId) return;
    const res = await fetch('/api/game', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gameType: 'ogs',
        size: entry.width,
        color: 'random',
        ogsGameId,
        ogsUserId: ogsSeekGraph.userId,
        creatorName: displayName
      })
    });
    const { gameId } = await res.json();
    goto(`/play/${gameId}`);
  }

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
  let ogsStreams = $state([]);

  function visibleOgsChallenges() {
    const showOgs = getMe()?.settings?.showOgsGames;
    if (showOgs === false) return [];
    return ogsSeekGraph.challenges;
  }

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

  function getOgsToken() {
    const pairs = document.cookie.split(';');
    for (const pair of pairs) {
      const [key, value] = pair.trim().split('=');
      if (key === 'ogs_token') return decodeURIComponent(value);
    }
    return null;
  }

  async function getStreams() {
    const ogsToken = getOgsToken();
    const res = await fetch(`https://online-go.com/api/v1/gotv/streams/`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${ogsToken}` }
    });
    if (!res.ok) return null;
    let streams = await res.json();
    ogsStreams = streams.slice(0, 2);
  }

  async function refreshCorrGames() {
    const res = await fetch('/api/games?type=correspondence');
    corrGames = await res.json();
  }

  onMount(async () => {
    ogsSeekGraph.start();
    await getStreams();

    return () => ogsSeekGraph.stop();
  });

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

  let setupModal = $state(null); // 'hook' | 'friend' | null
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
        <HookTable
          games={pendingGames}
          onJoin={(id) => goto(`/play/${id}`)}
          ogsChallenges={visibleOgsChallenges()}
          onAcceptOgs={acceptOgsChallenge}
        />
      {:else if activeTab === 'correspondence'}
        <HookTable games={corrGames} onJoin={(id) => goto(`/play/${id}`)} />
      {/if}
    </div>
  </div>

  <div class="lobby__side">
    {#if ogsStreams.length > 0}
      <section class="lobby__streams">
        {#each ogsStreams as stream}
          <a href="https://twitch.tv/{stream.username}" class="stream highlight"
            ><strong class="text" data-icon="">{stream.username}</strong> {stream.title}</a
          >
        {/each}
      </section>
    {/if}
    <ActiveGamesPanel games={liveGames} />
  </div>

  <div class="lobby__table">
    <StartButtons
      playersOnline={pingState.lobbyStats.playersOnline}
      gamesInPlay={pingState.lobbyStats.gamesInPlay}
      onCreateGame={() => (setupModal = 'hook')}
      onChallengeFriend={() => (setupModal = 'friend')}
      onPlayLocally={() => (setupModal = 'ai')}
    />
  </div>

  {#if data.dailyPuzzle}
    <LobbyPuzzle puzzle={data.dailyPuzzle} />
  {/if}

  {#if setupModal}
    <GameSetupModal
      gameType={setupModal}
      creatorName={displayName}
      onClose={() => (setupModal = null)}
    />
  {/if}

  <LobbyAbout />
</div>
