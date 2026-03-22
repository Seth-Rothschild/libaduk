<script>
  let { game, joinerName, onJoined } = $props();

  let dialog = $state(null);
  let loading = $state(false);

  $effect(() => {
    dialog?.showModal();
  });

  const openColor = game.creatorColor === 'black' ? 'white' : 'black';

  function timeControlLabel(tc) {
    if (tc.type === 'none') return 'Unlimited';
    if (tc.type === 'byoyomi') {
      const min = Math.floor(tc.initial / 60);
      return `${min}+${tc.periods}×${tc.periodTime}s Byo-yomi`;
    }
    if (tc.type === 'fischer') {
      const min = Math.floor(tc.initial / 60);
      return `${min}+${tc.increment} Fischer`;
    }
    if (tc.type === 'correspondence') return `${tc.days} day${tc.days === 1 ? '' : 's'} per turn`;
    return '';
  }

  async function join() {
    loading = true;
    try {
      const res = await fetch('/api/game/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId: game.id, joinerName })
      });
      const result = await res.json();
      if (result.color) {
        dialog?.close();
        onJoined(result.color);
      }
    } finally {
      loading = false;
    }
  }
</script>

<dialog bind:this={dialog} class="game-setup join-game-modal">
  <div class="scrollable">
    <h2>Join Game</h2>

    <div class="setup-content">
      <div class="join-info">
        <div class="join-row">
          <span class="join-label">Board</span>
          <span class="join-value">{game.size}×{game.size}</span>
        </div>
        <div class="join-row">
          <span class="join-label">Time</span>
          <span class="join-value">{timeControlLabel(game.timeControl)}</span>
        </div>
        <div class="join-row">
          <span class="join-label">You play</span>
          <span class="join-value">{openColor}</span>
        </div>
      </div>
    </div>

    <div class="footer">
      <button
        class="button button-metal lobby__start__button lobby__start__button--friend"
        onclick={join}
        disabled={loading}
        class:disabled={loading}
      >
        Join game
      </button>
      {#if loading}
        <div class="spinner"></div>
      {/if}
    </div>
  </div>
</dialog>

<style>
  .join-info {
    display: flex;
    flex-direction: column;
    gap: 0.8em;
    padding: 1em 0;
  }

  .join-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 1.1em;
  }

  .join-label {
    color: var(--c-font-dim, #888);
  }

  .join-value {
    font-weight: bold;
  }
</style>
