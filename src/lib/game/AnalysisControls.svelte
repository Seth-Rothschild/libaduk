<script>
  import { scoreVerdictShort } from '$lib/gameUtils.js';

  const KOMI = 6.5;

  let {
    analysisTool,
    analysisStatus,
    analysisScore,
    analysisEstimatedScore,
    analysisShowEstimate,
    onSetTool,
    onStartScoring,
    onStopScoring,
    onToggleEstimate,
    onExit
  } = $props();

  const MARKER_TOOLS = [
    { id: 'stone', label: 'Stone', title: 'Place stones' },
    { id: 'cross', label: '✕', title: 'Mark X' },
    { id: 'circle', label: '◯', title: 'Mark circle' },
    { id: 'square', label: '⬜', title: 'Mark square' },
    { id: 'triangle', label: '△', title: 'Mark triangle' },
    { id: 'label', label: 'A', title: 'Label (A, B, C...)' },
    { id: 'number', label: '1', title: 'Number (1, 2, 3...)' }
  ];
</script>

{#if analysisStatus === 'scoring'}
  <button class="button button-green" onclick={onStopScoring}>Back to analysis</button>
  {#if analysisScore}
    <div class="score-display">
      <span class="color-icon is black text">{analysisScore.blackArea}</span>
      <span class="color-icon is white text">
        {analysisScore.whiteArea} + {KOMI} = {analysisScore.whiteScore.toFixed(1)}
      </span>
      <strong>{scoreVerdictShort(analysisScore)}</strong>
    </div>
  {/if}
{:else}
  <div class="tool-buttons">
    {#each MARKER_TOOLS as tool}
      <button
        class="button"
        class:button-green={analysisTool === tool.id}
        class:button-metal={analysisTool !== tool.id}
        onclick={() => onSetTool(tool.id)}
        title={tool.title}>{tool.label}</button
      >
    {/each}
  </div>
  <button class="button button-metal" onclick={onStartScoring}>Score</button>
  <button
    class="button"
    class:button-green={analysisShowEstimate}
    class:button-metal={!analysisShowEstimate}
    onclick={onToggleEstimate}>Estimate</button
  >
  {#if analysisEstimatedScore}
    <div class="score-display">
      <span class="color-icon is black text">{analysisEstimatedScore.blackArea}</span>
      <span class="color-icon is white text">
        {analysisEstimatedScore.whiteArea} + {KOMI} = {analysisEstimatedScore.whiteScore.toFixed(1)}
      </span>
      <strong>{scoreVerdictShort(analysisEstimatedScore)}</strong>
    </div>
  {/if}
{/if}

<button class="button button-metal" onclick={onExit}>Back to game</button>
