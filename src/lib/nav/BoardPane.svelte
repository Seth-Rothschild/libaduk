<script>
  import { boardState } from '$lib/boardState.svelte.js';

  let { onBack } = $props();
</script>

<button class="sub-head text" data-icon="&#xe047;" onclick={onBack}>Board</button>
<div class="board-settings">
  <label class="board-setting-toggle">
    <input
      type="checkbox"
      checked={boardState.showCoords}
      onchange={boardState.toggleCoords}
    />
    Coordinates
  </label>
</div>
