<script>
  import { scoreVerdictShort } from '$lib/gameUtils.js';

  const KOMI = 6.5;

  const MARKER_TOOLS = [
    { id: 'stone', label: 'Stone', title: 'Place stones' },
    { id: 'cross', label: '✕', title: 'Mark X' },
    { id: 'circle', label: '◯', title: 'Mark circle' },
    { id: 'square', label: '⬜', title: 'Mark square' },
    { id: 'triangle', label: '△', title: 'Mark triangle' },
    { id: 'label', label: 'A', title: 'Label (A, B, C...)' },
    { id: 'number', label: '1', title: 'Number (1, 2, 3...)' }
  ];

  let {
    tool,
    status,
    score,
    estimatedScore,
    showEstimate,
    onSetTool,
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
  <div class="tool-buttons">
    {#each MARKER_TOOLS as t}
      <button
        class="button"
        class:button-green={tool === t.id}
        class:button-metal={tool !== t.id}
        onclick={() => onSetTool(t.id)}
        title={t.title}>{t.label}</button
      >
    {/each}
  </div>
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
