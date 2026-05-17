<script>
  let { tool, onSetTool, splitMode = false, onToggleSplit = null } = $props();

  const tools = [
    { id: 'stone', title: 'Place stones (game order)' },
    { id: 'stone-black', title: 'Place black stones' },
    { id: 'stone-white', title: 'Place white stones' },
    { id: 'cross', title: 'Mark X' },
    { id: 'triangle', title: 'Mark triangle' },
    { id: 'square', title: 'Mark square' },
    { id: 'circle', title: 'Mark circle' },
    { id: 'label', title: 'Label (A, B, C...)' },
    { id: 'number', title: 'Number (1, 2, 3...)' }
  ];
</script>

<div class="edit-bar">
  {#each tools as t}
    <button
      class="edit-bar-btn"
      class:selected={tool === t.id}
      title={t.title}
      onclick={() => onSetTool(t.id)}
    >
      <svg width="20" height="20" viewBox="0 0 20 20">
        {#if t.id === 'stone'}
          <circle cx="7" cy="7" r="6" stroke="currentColor" stroke-width="2" fill="currentColor" />
          <circle cx="13" cy="13" r="6" stroke="currentColor" stroke-width="2" fill="none" />
        {:else if t.id === 'stone-black'}
          <circle
            cx="10"
            cy="10"
            r="8"
            stroke="currentColor"
            stroke-width="2"
            fill="currentColor"
          />
        {:else if t.id === 'stone-white'}
          <circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="2" fill="none" />
        {:else if t.id === 'cross'}
          <line x1="2" y1="2" x2="18" y2="18" stroke="currentColor" stroke-width="2" />
          <line x1="18" y1="2" x2="2" y2="18" stroke="currentColor" stroke-width="2" />
        {:else if t.id === 'triangle'}
          <line x1="1" y1="19" x2="19" y2="19" stroke="currentColor" stroke-width="2" />
          <line x1="19" y1="19" x2="10" y2="1" stroke="currentColor" stroke-width="2" />
          <line x1="10" y1="1" x2="1" y2="19" stroke="currentColor" stroke-width="2" />
        {:else if t.id === 'square'}
          <rect
            x="1"
            y="1"
            width="18"
            height="18"
            stroke="currentColor"
            stroke-width="2"
            fill="none"
          />
        {:else if t.id === 'circle'}
          <circle cx="10" cy="10" r="9" stroke="currentColor" stroke-width="2" fill="none" />
        {:else if t.id === 'label'}
          <line x1="5" y1="13" x2="15" y2="13" stroke="currentColor" stroke-width="2" />
          <line x1="17" y1="19" x2="10" y2="1" stroke="currentColor" stroke-width="2" />
          <line x1="10" y1="1" x2="3" y2="19" stroke="currentColor" stroke-width="2" />
        {:else if t.id === 'number'}
          <line x1="10" y1="2" x2="5" y2="5" stroke="currentColor" stroke-width="2" />
          <line x1="10" y1="1" x2="10" y2="18" stroke="currentColor" stroke-width="2" />
          <line x1="14" y1="18" x2="6" y2="18" stroke="currentColor" stroke-width="2" />
        {/if}
      </svg>
    </button>
  {/each}
  {#if onToggleSplit}
    <button
      class="edit-bar-btn edit-bar-split"
      class:selected={splitMode}
      title={splitMode ? 'Close split board' : 'Split board'}
      onclick={onToggleSplit}
    >
      <svg width="20" height="20" viewBox="0 0 20 20">
        <rect
          x="1"
          y="2"
          width="8"
          height="16"
          stroke="currentColor"
          stroke-width="2"
          fill="none"
        />
        <rect
          x="11"
          y="2"
          width="8"
          height="16"
          stroke="currentColor"
          stroke-width="2"
          fill="none"
        />
      </svg>
    </button>
  {/if}
</div>

<style>
  .edit-bar {
    display: flex;
    justify-content: center;
    gap: 2px;
    padding: 4px 6px;
    background: var(--c-bg-box);
    border-radius: 0 0 6px 6px;
    border-top: 1px solid var(--c-border);
  }

  .edit-bar-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 30px;
    padding: 4px;
    border: none;
    border-radius: 3px;
    background: none;
    color: var(--c-font-dim);
    cursor: pointer;
    transition:
      background 0.15s,
      color 0.15s;
  }

  .edit-bar-btn:hover {
    background: var(--c-bg-zebra);
    color: var(--c-font);
  }

  .edit-bar-btn.selected {
    background: var(--c-accent);
    color: #fff;
  }

  .edit-bar-split {
    margin-left: 6px;
    border-left: 1px solid var(--c-border);
    border-radius: 0 3px 3px 0;
    padding-left: 8px;
  }
</style>
