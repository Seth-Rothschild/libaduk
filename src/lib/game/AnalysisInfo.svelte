<script>
  import { colorName, formatVertex } from '$lib/game/board';

  let {
    blackCaptures,
    whiteCaptures,
    currentNode,
    boardSize,
    comment = '',
    onCommentChange
  } = $props();

  const lastMoveColor = $derived(
    currentNode?.lastMove ? colorName(currentNode.signToPlay === 1 ? -1 : 1) : null
  );
  const lastMoveCoord = $derived(
    currentNode?.lastMove ? formatVertex(currentNode.lastMove, boardSize) : null
  );

  function handleCommentInput(e) {
    onCommentChange?.(e.target.value);
  }
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
  <div class="comment-section">
    <textarea
      class="comment-input"
      placeholder="Add a comment..."
      value={comment}
      oninput={handleCommentInput}
    ></textarea>
  </div>
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

  .comment-section {
    margin-top: 0.5em;
    border-top: 1px solid var(--c-border);
    padding-top: 0.5em;
  }

  .comment-input {
    width: 100%;
    min-height: 4em;
    resize: vertical;
    background: var(--c-bg-input, var(--c-bg-box));
    color: var(--c-font);
    border: 1px solid var(--c-border);
    border-radius: 3px;
    padding: 0.4em;
    font: inherit;
    font-size: 0.85em;
    line-height: 1.4;
  }

  .comment-input:focus {
    outline: 1px solid var(--c-primary);
    border-color: var(--c-primary);
  }
</style>
