<script>
  let { children, layout = '' } = $props();
</script>

{#if layout === 'lobby'}
  <div class="lobby">
    {@render children()}
  </div>
{:else if layout === 'lobby-app'}
  <div class="lobby">
    <div class="lobby__app">
      <div class="lobby__pools-wrap">
        {@render children()}
      </div>
    </div>
  </div>
{:else if layout === 'lobby-table'}
  <div class="lobby">
    <div class="lobby__table">
      {@render children()}
    </div>
  </div>
{:else if layout === 'game-app'}
  <div class="round">
    <div class="round__app">
      {@render children()}
    </div>
  </div>
{:else if layout === 'game-side'}
  <div class="round">
    <aside class="round__side">
      {@render children()}
    </aside>
  </div>
{:else}
  {@render children()}
{/if}
