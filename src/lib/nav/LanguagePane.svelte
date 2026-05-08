<script>
  import { locale, t } from '$lib/i18n/i18n.svelte.js';

  let { onBack } = $props();

  const languages = [
    ['zh', '中文'],
    ['en', 'English'],
    ['ja', '日本語'],
    ['ko', '한국어']
  ];
</script>

<button class="sub-head text" data-icon="&#xe027;" onclick={onBack}>{t('Language')}</button>
<div class="selector">
  {#each languages as [code, label]}
    <button
      class="text"
      class:active={locale.current === code}
      data-icon="&#xe023;"
      onclick={() => locale.set(code)}>{label}</button
    >
  {/each}
</div>
