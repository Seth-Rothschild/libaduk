<script>
  let { games } = $props();
</script>

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
