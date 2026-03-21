<script>
  import { themeState } from '$lib/theme.svelte.js';

  let { onBack } = $props();

  const themes = [
    ['system', 'Auto'],
    ['light', 'Light'],
    ['dark', 'Dark']
  ];
</script>

<button class="sub-head text" data-icon="&#xe047;" onclick={onBack}>Background</button>
<div class="selector">
  {#each themes as [value, label]}
    <button
      class="text"
      class:active={themeState.setting === value}
      data-icon="&#xe023;"
      onclick={() => themeState.set(value)}>{label}</button
    >
  {/each}
</div>
