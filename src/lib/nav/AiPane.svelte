<script>
  import { onMount } from 'svelte';

  let { onBack } = $props();

  let ModelManager = $state(null);

  onMount(async () => {
    const mod = await import('$lib/ai/ModelManager.svelte');
    ModelManager = mod.default;
  });
</script>

<button class="sub-head text" data-icon="&#xe047;" onclick={onBack}>Computer AI</button>
{#if ModelManager}
  <div class="ai-pane">
    <svelte:component this={ModelManager} />
  </div>
{:else}
  <div class="ai-pane-loading">Loading...</div>
{/if}

<style>
  .ai-pane {
    padding: 0.5rem 1rem;
  }

  .ai-pane-loading {
    padding: 0.5rem 1rem;
    color: var(--c-font-dim, #999);
    font-size: 0.85rem;
  }
</style>
