<script>
  import { t } from '$lib/i18n/i18n.svelte.js';

  let { clock, label, size, custom = false, onClick, onCancel } = $props();
  let spinning = $state(false);
</script>

<div
  class="lpool"
  class:lpool--custom={custom}
  class:active={spinning}
  role="button"
  tabindex="0"
  onclick={async () => {
    if (spinning) {
      await onCancel?.();
      spinning = false;
    } else {
      spinning = true;
      await onClick?.();
      spinning = false;
    }
  }}
  onkeydown={(e) => e.key === 'Enter' && e.target.click()}
>
  {#if spinning}
    <svg class="pool-spinner" viewBox="0 0 70 70">
      <g stroke-width="5">
        <circle class="pool-spinner__fill" cx="35" cy="35" r="28" stroke="none" />
        <circle class="pool-spinner__outline" cx="35" cy="35" r="28" fill="none" />
      </g>
    </svg>
  {:else}
    <span class="clock">{clock}</span>
    {#if size}
      <span class="board-size">{size}×{size}</span>
    {/if}
    {#if label}
      <span class="perf">{t(label)}</span>
    {/if}
  {/if}
</div>
