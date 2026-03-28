<script>
  let {
    feedback,
    colorToPlay,
    onRetry = null,
    onViewSolution = null,
    onGetHint = null,
    onVoteUp = null,
    onVoteDown = null,
    onNextPuzzle = null,
    showSolutionButtons = true
  } = $props();
</script>

{#if feedback === 'init'}
  <div class="puzzle__feedback play">
    <div class="player">
      <div class="no-square">
        <div
          class="go-stone-icon go-stone-icon-{colorToPlay === 'White' ? 'white' : 'black'}"
        ></div>
      </div>
      <div class="instruction">
        <strong>Your turn</strong>
        <em>Find the best move for {colorToPlay.toLowerCase()}.</em>
      </div>
    </div>
    {#if showSolutionButtons}
      <div class="view_solution show">
        <button class="button button-empty" onclick={onGetHint}>Get a hint</button>
        <button class="button button-empty" onclick={onViewSolution}>View the solution</button>
      </div>
    {/if}
  </div>
{:else if feedback === 'good'}
  <div class="puzzle__feedback good">
    <div class="player">
      <div class="icon">✓</div>
      <div class="instruction">
        <strong>Best move!</strong>
        <em>Keep going...</em>
      </div>
    </div>
    {#if showSolutionButtons}
      <div class="view_solution show">
        <button class="button button-empty" onclick={onGetHint}>Get a hint</button>
        <button class="button button-empty" onclick={onViewSolution}>View the solution</button>
      </div>
    {/if}
  </div>
{:else if feedback === 'fail'}
  <div class="puzzle__feedback fail">
    <div class="player">
      <div class="icon">✗</div>
      <div class="instruction">
        <strong>That's not the move!</strong>
        <em>But you can keep trying.</em>
      </div>
    </div>
    {#if showSolutionButtons}
      <div class="view_solution show">
        <button class="button button-empty" onclick={onGetHint}>Get a hint</button>
        <button class="button button-empty" onclick={onViewSolution}>View the solution</button>
      </div>
    {/if}
  </div>
{:else if feedback === 'after'}
  <div class="puzzle__feedback after">
    <div class="complete">Puzzle complete!</div>
    <div class="puzzle__vote">
      <div class="puzzle__vote__help">
        <p>Did you like this puzzle? Vote to load the next one!</p>
      </div>
      <div class="puzzle__vote__buttons enabled">
        <button class="vote vote-up" onclick={() => onVoteUp?.()}></button>
        <button class="vote vote-down" onclick={() => onVoteDown?.()}></button>
      </div>
    </div>
    <div class="puzzle__more">
      <button onclick={() => onNextPuzzle?.()}>Continue training</button>
    </div>
  </div>
{/if}
