<script>
  import { boardSettings } from './boardSettings.svelte.js';

  let { onBack } = $props();
</script>

<button class="sub-head text" data-icon="&#xe027;" onclick={onBack}>Board</button>
<div class="board-settings">
  <label class="board-setting-toggle">
    <input
      type="checkbox"
      checked={boardSettings.showCoords}
      onchange={boardSettings.toggleCoords}
    />
    Coordinates
  </label>
  <label class="board-setting-toggle">
    <input
      type="checkbox"
      checked={boardSettings.fuzzyPlacement}
      onchange={boardSettings.toggleFuzzyPlacement}
    />
    Fuzzy placement
  </label>
  <div class="board-setting-row">
    Move confirmation
    <select
      value={boardSettings.moveConfirmation}
      onchange={(e) => boardSettings.setMoveConfirmation(e.target.value)}
    >
      <option value="none">None</option>
      <option value="double-click">Double-click</option>
      <option value="button">Button</option>
    </select>
  </div>
</div>
