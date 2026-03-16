<script>
  let { games } = $props();
</script>

<div class="lobby__side">
  <div class="lobby__box">
    <div class="lobby__box__top">
      <span>Active games</span>
    </div>
    <div class="lobby__box__content">
      {#if games.length === 0}
        <p class="lobby__side-empty">No games in progress.</p>
      {:else}
        <div class="lobby__live-list">
          {#each games as game}
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

<style>
  .lobby__box {
    padding-left: 0.8em;
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
