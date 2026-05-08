<script>
  import PoolCard from './PoolCard.svelte';
  import { t } from '$lib/i18n/i18n.svelte.js';

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
    <PoolCard clock={t('Custom')} custom={true} onClick={() => onCustom?.()} />
  {/if}
</div>
