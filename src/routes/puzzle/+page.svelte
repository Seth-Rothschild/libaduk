<script>
  import { goto } from '$app/navigation';
  import GoBoard from '$lib/game/GoBoard.svelte';
  import PuzzleFeedback from '$lib/game/PuzzleFeedback.svelte';
  import { PuzzleState } from '$lib/game/puzzleState.svelte.js';
  import {
    getChips,
    startChip,
    resolveChip,
    getAutoNext,
    setAutoNext
  } from '$lib/game/puzzleSession.svelte.js';
  import { boardSettings } from '$lib/nav/boardSettings.svelte.js';
  import { computeVertexSize } from '$lib/game/layout.js';
  import { onMount } from 'svelte';

  let { data } = $props();

  const puzzle = new PuzzleState(data.puzzle.sgf, {
    onFeedback(feedback) {
      if (feedback === 'after') {
        resolveChip(data.puzzle.id, !puzzle.hadFailure);
      } else if (feedback === 'fail') {
        resolveChip(data.puzzle.id, false);
      }
    }
  });

  startChip(data.puzzle.id);

  let boardContainerWidth = $state(0);
  let boardContainerHeight = $state(0);
  const vertexSize = $derived(
    computeVertexSize(boardContainerWidth, boardContainerHeight, puzzle.size)
  );

  const chips = $derived(getChips());

  const autoNext = $derived(getAutoNext());
  let completed = $state(false);

  async function completePuzzle(vote = null) {
    if (completed) return;
    completed = true;
    const body = { puzzleId: data.puzzle.id };
    if (vote) body.vote = vote;
    await fetch('/api/puzzle/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  }

  async function goToNextPuzzle() {
    const res = await fetch('/api/puzzle/random');
    const next = await res.json();
    goto(`/puzzle/${next.id}`);
  }

  async function handleVote(vote) {
    await completePuzzle(vote);
    goToNextPuzzle();
  }

  async function handleNextPuzzle() {
    await completePuzzle();
    goToNextPuzzle();
  }

  $effect(() => {
    if (puzzle.feedback === 'after' && autoNext) {
      completePuzzle();
      goToNextPuzzle();
    }
  });

  function handleKeydown(e) {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      puzzle.goPrev();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      puzzle.goNext();
    } else if (e.key === 'Home') {
      e.preventDefault();
      puzzle.goFirst();
    } else if (e.key === 'End') {
      e.preventDefault();
      puzzle.goLast();
    }
  }

  onMount(() => {
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  });
</script>

<main class="puzzle puzzle-play">
  <!-- LEFT: side panel -->
  <aside class="puzzle__side">
    <!-- Puzzle info: icon, ID, rating, play count -->
    <div class="puzzle__side__metas">
      <div class="infos puzzle">
        <img class="infos__angle-img" src="/images/go/stone_-1.svg" alt="Puzzle Themes" />
        <div>
          <p>Puzzle <a href="/puzzle/{data.puzzle.id}">#{data.puzzle.id}</a></p>
          <p>
            Rating: <strong
              >{data.puzzle.totalVotes > 0
                ? Math.trunc((data.puzzle.likes / data.puzzle.totalVotes) * 100)
                : 0}% ({data.puzzle.likes}/{data.puzzle.totalVotes})</strong
            >
          </p>
          <p>Played <strong>{data.puzzle.plays.toLocaleString()}</strong> times</p>
        </div>
      </div>

      <!-- Dataset citation -->
      <div class="infos" data-icon="&#xe002;">
        <div>
          <p>
            From <a href="https://walruswq.com/datasets" target="_blank" rel="noopener"
              >Walrus Weiqi</a
            >
          </p>
          <p>FoxWQ Exercise Collection</p>
        </div>
      </div>
    </div>

    <!-- User rating + rated toggle -->
    <!-- <div class="puzzle__side__user">
      <label class="cmn-toggle-wrap">
        <span class="cmn-toggle" role="button">
          <input type="checkbox" checked />
          <label></label>
        </span>
        Rated
      </label>
      <div class="puzzle__side__user__rating">
        <strong>1500</strong>
      </div>
    </div> -->

    <!-- Theme: Daily Puzzle link -->
    <!-- <div class="puzzle__side__theme puzzle__side__theme--daily">
      <a class="puzzle__side__theme__back" href="/puzzle/themes">« Daily Puzzle</a>
    </div> -->

    <!-- Config: auto-next + difficulty -->
    <div class="puzzle__side__config">
      <label class="cmn-toggle-wrap">
        <span class="cmn-toggle" role="button">
          <input
            type="checkbox"
            checked={autoNext}
            onchange={(e) => setAutoNext(e.target.checked)}
          />
          <label></label>
        </span>
        Jump to next puzzle immediately
      </label>
      <!-- <form class="puzzle__side__config__difficulty">
        <label for="puzzle-difficulty">Difficulty level</label>
        <select id="puzzle-difficulty" class="puzzle__difficulty__selector" name="difficulty">
          <option value="easiest" title="600 points below your puzzle rating">Easiest (-600)</option>
          <option value="easier" title="300 points below your puzzle rating">Easier (-300)</option>
          <option value="normal" selected title="0 points above your puzzle rating">Normal</option>
          <option value="harder" title="300 points above your puzzle rating">Harder (+300)</option>
          <option value="hardest" title="600 points above your puzzle rating">Hardest (+600)</option>
        </select>
      </form> -->
    </div>
  </aside>

  <!-- CENTER: board -->
  <div
    class="puzzle__board main-board"
    bind:clientWidth={boardContainerWidth}
    bind:clientHeight={boardContainerHeight}
  >
    <GoBoard
      signMap={puzzle.signMap}
      lastMove={puzzle.lastMove}
      shiftMap={boardSettings.fuzzyPlacement ? puzzle.shiftMap : null}
      animatedVertex={puzzle.animatedVertex}
      size={puzzle.size}
      {vertexSize}
      showCoords={boardSettings.showCoords}
      currentSign={puzzle.currentSign}
      onVertexClick={(x, y) => puzzle.onVertexClick(x, y)}
    />
  </div>

  <!-- RIGHT: tools (move list + feedback) -->
  <div class="puzzle__tools">
    <div class="puzzle__moves analysis-moves">
      <table class="moves-table">
        <thead>
          <tr>
            <th class="moves-col-num"></th>
            <th class="moves-col-black">Black</th>
            <th class="moves-col-white">White</th>
          </tr>
        </thead>
        <tbody>
          {#each puzzle.moveRows as row, i}
            <tr>
              <td class="moves-col-num">{row.moveNum}.</td>
              <td class="moves-col-black">
                {#if row.black}
                  <span
                    class="move-entry"
                    class:active={row.blackIndex === puzzle.playedMoves.length - 1}
                  >
                    {row.black.label}
                  </span>
                {/if}
              </td>
              <td class="moves-col-white">
                {#if row.white}
                  <span
                    class="move-entry"
                    class:active={row.whiteIndex === puzzle.playedMoves.length - 1}
                  >
                    {row.white.label}
                  </span>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    <PuzzleFeedback
      feedback={puzzle.feedback}
      colorToPlay={puzzle.colorToPlay}
      onRetry={() => puzzle.retry()}
      onViewSolution={() => puzzle.viewSolution()}
      onGetHint={() => puzzle.getHint()}
      onVoteUp={() => handleVote('up')}
      onVoteDown={() => handleVote('down')}
      onNextPuzzle={() => handleNextPuzzle()}
    />
  </div>

  <!-- BOTTOM-RIGHT: navigation buttons -->
  <div class="puzzle__controls analyse-controls">
    <div class="jumps">
      <button
        class="fbt"
        disabled={!puzzle.canPrev}
        data-act="first"
        onclick={() => puzzle.goFirst()}>⏮</button
      >
      <button class="fbt" disabled={!puzzle.canPrev} data-act="prev" onclick={() => puzzle.goPrev()}
        >◀</button
      >
      <button class="fbt" disabled={!puzzle.canNext} data-act="next" onclick={() => puzzle.goNext()}
        >▶</button
      >
      <button class="fbt" disabled={!puzzle.canNext} data-act="last" onclick={() => puzzle.goLast()}
        >⏭</button
      >
    </div>
  </div>

  <!-- BOTTOM-LEFT: session dots -->
  <div class="puzzle__session">
    {#each chips as chip}
      <a
        href="/puzzle/{chip.id}"
        class:session-new={chip.result === null}
        class:result-true={chip.result === true}
        class:result-false={chip.result === false}
        class:result-empty={chip.result !== null}
      ></a>
    {/each}
  </div>
</main>
