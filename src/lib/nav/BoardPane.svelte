<script>
  import { boardSettings } from './boardSettings.svelte.js';
  import ThemePane from './ThemePane.svelte';
  import { t } from '$lib/i18n/i18n.svelte.js';

  let { onBack } = $props();
</script>

<button class="sub-head text" data-icon="&#xe027;" onclick={onBack}>{t('Board')}</button>
<div class="board-settings">
  <section class="board-setting">
    <h2>{t('Coordinates')}</h2>
    <group class="radio">
      <div>
        <input
          type="radio"
          id="coords-no"
          name="coords"
          checked={!boardSettings.showCoords}
          onchange={boardSettings.toggleCoords}
        />
        <label for="coords-no">{t('No')}</label>
      </div>
      <div>
        <input
          type="radio"
          id="coords-yes"
          name="coords"
          checked={boardSettings.showCoords}
          onchange={boardSettings.toggleCoords}
        />
        <label for="coords-yes">{t('Yes')}</label>
      </div>
    </group>
  </section>
  <section class="board-setting">
    <h2>{t('Fuzzy placement')}</h2>
    <group class="radio">
      <div>
        <input
          type="radio"
          id="fuzzy-no"
          name="fuzzy"
          checked={!boardSettings.fuzzyPlacement}
          onchange={boardSettings.toggleFuzzyPlacement}
        />
        <label for="fuzzy-no">{t('No')}</label>
      </div>
      <div>
        <input
          type="radio"
          id="fuzzy-yes"
          name="fuzzy"
          checked={boardSettings.fuzzyPlacement}
          onchange={boardSettings.toggleFuzzyPlacement}
        />
        <label for="fuzzy-yes">{t('Yes')}</label>
      </div>
    </group>
  </section>
  <section class="board-setting stacked">
    <h2>{t('Move confirmation')}</h2>
    <group class="radio">
      <div>
        <input
          type="radio"
          id="confirm-none"
          name="confirm"
          checked={boardSettings.moveConfirmation === 'none'}
          onchange={() => boardSettings.setMoveConfirmation('none')}
        />
        <label for="confirm-none">{t('None')}</label>
      </div>
      <div>
        <input
          type="radio"
          id="confirm-dbl"
          name="confirm"
          checked={boardSettings.moveConfirmation === 'double-click'}
          onchange={() => boardSettings.setMoveConfirmation('double-click')}
        />
        <label for="confirm-dbl">{t('2-click')}</label>
      </div>
      <div>
        <input
          type="radio"
          id="confirm-btn"
          name="confirm"
          checked={boardSettings.moveConfirmation === 'button'}
          onchange={() => boardSettings.setMoveConfirmation('button')}
        />
        <label for="confirm-btn">{t('Button')}</label>
      </div>
    </group>
  </section>
  <hr class="board-settings-divider" />
  <section class="board-setting stacked">
    <h2>{t('Stones & Board')}</h2>
    <ThemePane />
  </section>
</div>
