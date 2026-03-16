<script>
  import PoolCard from './PoolCard.svelte';

  let { pools, onSelect, showCustom = true, onCustom } = $props();
</script>

<div class="lpools">
  {#each pools as pool}
    <PoolCard
      clock={pool.clock}
      label={pool.label}
      size={pool.size}
      onClick={() => onSelect?.(pool)}
    />
  {/each}
  {#if showCustom}
    <PoolCard clock="Custom" custom={true} onClick={() => onCustom?.()} />
  {/if}
</div>
