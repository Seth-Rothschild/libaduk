<script>
  import { formatVertex } from '$lib/gameUtils.js';

  let { analysisMoveRows, analysisNode, boardSize, onSelectNode } = $props();
</script>

<div class="analysis-moves">
  {#if analysisMoveRows.length > 0}
    <table class="moves-table">
      <thead>
        <tr>
          <th class="moves-col-num"></th>
          <th class="moves-col-black">Black</th>
          <th class="moves-col-white">White</th>
        </tr>
      </thead>
      <tbody>
        {#each analysisMoveRows as row}
          <tr>
            <td class="moves-col-num">{row.moveNum}.</td>
            <td class="moves-col-black">
              <button
                class="move-entry"
                class:active={row.black === analysisNode}
                onclick={() => onSelectNode(row.black)}
              >
                {formatVertex(row.black.lastMove, boardSize)}
                {#if row.black.children.length > 1}
                  <span class="move-branches">⑂</span>
                {/if}
              </button>
            </td>
            <td class="moves-col-white">
              {#if row.white}
                <button
                  class="move-entry"
                  class:active={row.white === analysisNode}
                  onclick={() => onSelectNode(row.white)}
                >
                  {formatVertex(row.white.lastMove, boardSize)}
                  {#if row.white.children.length > 1}
                    <span class="move-branches">⑂</span>
                  {/if}
                </button>
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  {:else}
    <div class="analysis-empty">Click the board to start analyzing</div>
  {/if}
</div>
