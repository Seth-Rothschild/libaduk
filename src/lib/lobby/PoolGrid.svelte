<script>
  import PoolCard from './PoolCard.svelte';

  let { pools, onSelect, onCancel, showCustom = true, onCustom } = $props();
</script>

<div class="lpools">
  {#each pools as pool}
    <PoolCard
      clock={pool.clock}
      label={pool.label}
      size={pool.size}
      onClick={() => onSelect?.(pool)}
      onCancel={() => onCancel?.()}
    />
  {/each}
  {#if showCustom}
    <PoolCard clock="Custom" custom={true} onClick={() => onCustom?.()} />
  {/if}
</div>
