<script>
  let { clock, label, size, custom = false, onClick } = $props();
</script>

<div
  class="lpool"
  class:lpool--custom={custom}
  role="button"
  tabindex="0"
  onclick={() => onClick?.()}
  onkeydown={(e) => e.key === 'Enter' && onClick?.()}
>
  <span class="clock">{clock}</span>
  {#if size}
    <span class="board-size">{size}×{size}</span>
  {/if}
  {#if label}
    <span class="perf">{label}</span>
  {/if}
</div>
