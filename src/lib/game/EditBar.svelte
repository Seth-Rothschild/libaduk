<script>
  let {
    tool,
    onSetTool,
    controlRequest = null,
    displayName = '',
    onControlToggle = null
  } = $props();

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

  {#if onControlToggle}
    <div class="edit-bar-divider"></div>
    {@const isMyRequest = controlRequest === displayName}
    {@const handTitle = isMyRequest
      ? 'Cancel request'
      : controlRequest
        ? `${controlRequest} wants to try something`
        : 'Request to try something'}
    <button
      class="edit-bar-btn edit-bar-btn--hand"
      class:selected={controlRequest !== null}
      title={handTitle}
      onclick={onControlToggle}
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="20" height="20">
        <path
          fill="currentColor"
          d="M496 136s-40.486 85.32-51.442 128.988c-14.33 57.118 2.078 100.297-18.747 155.68-35.998 64.97-38.435 75.466-169.81 75.33-48.132-.044-186.02-36.76-186.02-36.76C50.97 454.35 16 457.23 16 435.997c0-21.232 24.88-36.736 46.97-36.787l87.03 7.642c21.14-1.326 43.286-13.71 43.96-41.36-.353-40.927-4.4-72.357-25.175-105.6l-80.67-125.864c-4.818-10.02-5.964-27.105 7.983-34.732 13.947-7.628 29.793 3.71 35.205 13.582l90.11 122.57c9.618 8.955 26.738 10.68 25.278-8.38L206.903 44.652c-2.478-12.96 4.1-28.654 19.1-28.654 19.687 0 31.795 7.515 31.413 19.413l43.75 179.984c3.42 8.76 15.545 7.59 18.807-.49l12.462-175.022c.64-5.583 7.922-15.314 21.9-13.286 13.976 2.027 22.035 17 20.555 22.793l-4.044 172.936c2.838 15.327 14.888 17.565 24.266 9.008l61.22-109.487c3.72-9.183 18.288-11.096 26.715-7.455 7.84 5.107 12.954 11.96 12.954 21.603z"
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

  .edit-bar-divider {
    width: 1px;
    height: 20px;
    background: var(--c-border);
    margin: 0 2px;
    align-self: center;
  }
</style>
