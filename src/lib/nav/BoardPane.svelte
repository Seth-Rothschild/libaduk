<script>
  import { boardSettings } from './boardSettings.svelte.js';
  import ThemePane from './ThemePane.svelte';

  let { onBack } = $props();
</script>

<button class="sub-head text" data-icon="&#xe027;" onclick={onBack}>Board</button>
<div class="board-settings">
  <section class="board-setting">
    <h2>Coordinates</h2>
    <group class="radio">
      <div>
        <input
          type="radio"
          id="coords-no"
          name="coords"
          checked={!boardSettings.showCoords}
          onchange={boardSettings.toggleCoords}
        />
        <label for="coords-no">No</label>
      </div>
      <div>
        <input
          type="radio"
          id="coords-yes"
          name="coords"
          checked={boardSettings.showCoords}
          onchange={boardSettings.toggleCoords}
        />
        <label for="coords-yes">Yes</label>
      </div>
    </group>
  </section>
  <section class="board-setting">
    <h2>Fuzzy placement</h2>
    <group class="radio">
      <div>
        <input
          type="radio"
          id="fuzzy-no"
          name="fuzzy"
          checked={!boardSettings.fuzzyPlacement}
          onchange={boardSettings.toggleFuzzyPlacement}
        />
        <label for="fuzzy-no">No</label>
      </div>
      <div>
        <input
          type="radio"
          id="fuzzy-yes"
          name="fuzzy"
          checked={boardSettings.fuzzyPlacement}
          onchange={boardSettings.toggleFuzzyPlacement}
        />
        <label for="fuzzy-yes">Yes</label>
      </div>
    </group>
  </section>
  <section class="board-setting stacked">
    <h2>Move confirmation</h2>
    <group class="radio">
      <div>
        <input
          type="radio"
          id="confirm-none"
          name="confirm"
          checked={boardSettings.moveConfirmation === 'none'}
          onchange={() => boardSettings.setMoveConfirmation('none')}
        />
        <label for="confirm-none">None</label>
      </div>
      <div>
        <input
          type="radio"
          id="confirm-dbl"
          name="confirm"
          checked={boardSettings.moveConfirmation === 'double-click'}
          onchange={() => boardSettings.setMoveConfirmation('double-click')}
        />
        <label for="confirm-dbl">2-click</label>
      </div>
      <div>
        <input
          type="radio"
          id="confirm-btn"
          name="confirm"
          checked={boardSettings.moveConfirmation === 'button'}
          onchange={() => boardSettings.setMoveConfirmation('button')}
        />
        <label for="confirm-btn">Button</label>
      </div>
    </group>
  </section>
  <hr class="board-settings-divider" />
  <section class="board-setting stacked">
    <h2>Stones & Board</h2>
    <ThemePane />
  </section>
</div>
