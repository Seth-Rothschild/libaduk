<script>
  import { colorName, formatVertex } from '$lib/gameUtils.js';

  let { blackCaptures, whiteCaptures, currentNode, boardSize } = $props();

  const lastMoveColor = $derived(
    currentNode?.lastMove ? colorName(currentNode.signToPlay === 1 ? -1 : 1) : null
  );
  const lastMoveCoord = $derived(
    currentNode?.lastMove ? formatVertex(currentNode.lastMove, boardSize) : null
  );
</script>

<section class="analysis-info">
  <div class="captures-display">
    <span class="color-icon is black text">{blackCaptures}</span>
    <span class="color-icon is white text">{whiteCaptures}</span>
  </div>
  {#if lastMoveCoord}
    <div class="current-move-info">
      <span class="move-label">{lastMoveColor} {lastMoveCoord}</span>
      {#if currentNode.moveName}
        <span class="move-pattern">{currentNode.moveName}</span>
      {/if}
    </div>
  {/if}
</section>

<style>
  .analysis-info {
    padding: 0.5em;
  }

  .captures-display {
    display: flex;
    gap: 1em;
    font-size: 0.9em;
  }

  .current-move-info {
    margin-top: 0.4em;
    font-size: 0.85em;
    display: flex;
    flex-direction: column;
    gap: 0.15em;
  }

  .move-label {
    text-transform: capitalize;
  }

  .move-pattern {
    color: var(--c-accent);
    font-weight: bold;
  }
</style>
