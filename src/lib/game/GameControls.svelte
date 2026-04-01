<script>
  let {
    status,
    isSpectator,
    isMyTurn,
    myColor,
    analysisMode = false,
    blackApproved,
    whiteApproved,
    opponentOnline = null,
    onPass,
    onResign,
    onForceResign,
    onCancel,
    onApproveScore,
    onResumePlay = null,
    onAnalysis = null,
    onExitAnalysis = null
  } = $props();
</script>

{#if !isSpectator && status === 'waiting'}
  <button class="button button-red" onclick={onCancel}>Cancel Game</button>
{:else if !isSpectator && status === 'playing'}
  <button class="button button-metal" onclick={onPass} disabled={!isMyTurn}>Pass</button>
  {#if opponentOnline === false}
    <button class="button button-red" onclick={onForceResign}>Force Resignation</button>
  {:else}
    <button class="button button-red" onclick={onResign}>Resign</button>
  {/if}
{:else if !isSpectator && status === 'scoring'}
  {@const myApproved = myColor === 'black' ? blackApproved : whiteApproved}
  <button
    class="button"
    class:button-metal={!myApproved}
    class:button-green={myApproved}
    onclick={onApproveScore}
    disabled={myApproved}
  >
    {myApproved ? 'Score accepted' : 'Accept score'}
  </button>
  {#if onResumePlay}
    <button class="button button-metal" onclick={onResumePlay}>Resume play</button>
  {/if}
{/if}
{#if status === 'gameover'}
  {#if analysisMode && onExitAnalysis}
    <button class="button button-metal" onclick={onExitAnalysis}>Close analysis</button>
  {:else if !analysisMode && onAnalysis}
    <button class="button button-green" onclick={onAnalysis}>Analysis board</button>
  {/if}
{/if}
