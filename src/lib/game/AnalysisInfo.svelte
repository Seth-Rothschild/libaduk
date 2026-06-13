<script>
  import { colorName, formatVertex } from '$lib/game/board';

  let {
    blackCaptures,
    whiteCaptures,
    currentNode,
    boardSize,
    comment = '',
    onCommentChange,
    isBookmarked = false,
    bookmarkName = '',
    onBookmark,
    onBookmarkRename
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
  <div class="current-move-info">
    {#if lastMoveCoord}
      <span class="move-label">{lastMoveColor} {lastMoveCoord}</span>
      {#if currentNode.moveName}
        <span class="move-pattern">{currentNode.moveName}</span>
      {/if}
    {/if}
  </div>
  <div class="bookmark-row">
    <button class="bookmark-btn" class:bookmark-btn--active={isBookmarked} onclick={onBookmark}>
      {isBookmarked ? '★' : '☆'}
      {isBookmarked ? 'Bookmarked' : 'Bookmark'}
    </button>
    {#if isBookmarked}
      <input
        class="bookmark-name-input"
        value={bookmarkName}
        placeholder="Add title..."
        oninput={(e) => onBookmarkRename?.(e.target.value)}
      />
    {/if}
  </div>
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
    min-height: 3em;
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
    outline: 1px solid var(--c-secondary);
    border-color: var(--c-secondary);
  }

  .bookmark-row {
    margin-top: 0.4em;
  }

  .bookmark-btn {
    width: 100%;
    background: none;
    border: 1px solid var(--c-border);
    border-radius: 3px;
    color: var(--c-font-dim);
    cursor: pointer;
    font-size: 0.85em;
    padding: 0.3em 0.5em;
    text-align: left;
  }

  .bookmark-btn:hover {
    border-color: var(--c-secondary);
    color: var(--c-font);
  }

  .bookmark-btn--active {
    border-color: var(--c-secondary);
    color: var(--c-secondary);
  }

  .bookmark-name-input {
    margin-top: 0.3em;
    width: 100%;
    background: var(--c-bg-input, var(--c-bg-box));
    color: var(--c-font);
    border: 1px solid var(--c-border);
    border-radius: 3px;
    padding: 0.3em 0.4em;
    font: inherit;
    font-size: 0.85em;
  }

  .bookmark-name-input:focus {
    outline: 1px solid var(--c-secondary);
    border-color: var(--c-secondary);
  }
</style>
