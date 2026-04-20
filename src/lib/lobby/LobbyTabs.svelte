<script>
  const TABS = [
    { id: 'pools', label: 'Quick pairing' },
    { id: 'lobby', label: 'Lobby' },
    { id: 'correspondence', label: 'Correspondence' }
  ];

  let { activeTab = 'pools', onTabChange, myGamesCount = 0, myTurnCount = 0 } = $props();
</script>

<div class="tabs-horiz">
  {#each TABS as tab}
    <button class:active={activeTab === tab.id} onclick={() => onTabChange?.(tab.id)}>
      {tab.label}
    </button>
  {/each}
  {#if myGamesCount > 0}
    <button class:active={activeTab === 'now_playing'} onclick={() => onTabChange?.('now_playing')}>
      {myGamesCount}
      {myGamesCount === 1 ? 'game' : 'games'} in play
      {#if myTurnCount > 0}
        <span class="lobby-badge">{myTurnCount}</span>
      {/if}
    </button>
  {/if}
</div>
