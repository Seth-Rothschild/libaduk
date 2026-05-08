<script>
  import { themeState } from './theme.svelte.js';
  import { t } from '$lib/i18n/i18n.svelte.js';

  let { onBack } = $props();

  const themes = [
    ['system', 'Auto'],
    ['light', 'Light'],
    ['dark', 'Dark']
  ];
</script>

<button class="sub-head text" data-icon="&#xe027;" onclick={onBack}>{t('Background')}</button>
<div class="selector">
  {#each themes as [value, label]}
    <button
      class="text"
      class:active={themeState.setting === value}
      data-icon="&#xe023;"
      onclick={() => themeState.set(value)}>{t(label)}</button
    >
  {/each}
</div>
