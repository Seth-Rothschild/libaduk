<script>
  import { scoreVerdictShort } from '$lib/game/board';

  const KOMI = 6.5;

  let {
    status,
    score,
    estimatedScore,
    showEstimate,
    onStartScoring,
    onStopScoring,
    onToggleEstimate,
    onExit = null,
    onClear = null,
    onDownloadSgf = null,
    onImportSgf = null
  } = $props();
</script>

{#if status === 'scoring'}
  <button class="button button-green" onclick={onStopScoring}>Back to analysis</button>
  {#if score}
    <div class="score-display">
      <span class="color-icon is black text">{score.blackArea}</span>
      <span class="color-icon is white text">
        {score.whiteArea} + {KOMI} = {score.whiteScore.toFixed(1)}
      </span>
      <strong>{scoreVerdictShort(score)}</strong>
    </div>
  {/if}
{:else}
  <button class="button button-metal" onclick={onStartScoring}>Score</button>
  <button
    class="button"
    class:button-green={showEstimate}
    class:button-metal={!showEstimate}
    onclick={onToggleEstimate}>Estimate</button
  >
  {#if onClear}
    <button class="button button-metal" onclick={onClear}>Clear</button>
  {/if}
  {#if onDownloadSgf}
    <button class="button button-metal" onclick={onDownloadSgf}>Download SGF</button>
  {/if}
  {#if onImportSgf}
    <button class="button button-metal" onclick={onImportSgf}>Import SGF</button>
  {/if}
  {#if estimatedScore}
    <div class="score-display">
      <span class="color-icon is black text">{estimatedScore.blackArea}</span>
      <span class="color-icon is white text">
        {estimatedScore.whiteArea} + {KOMI} = {estimatedScore.whiteScore.toFixed(1)}
      </span>
      <strong>{scoreVerdictShort(estimatedScore)}</strong>
    </div>
  {/if}
{/if}

{#if onExit}
  <button class="button button-metal" onclick={onExit}>Back to game</button>
{/if}
