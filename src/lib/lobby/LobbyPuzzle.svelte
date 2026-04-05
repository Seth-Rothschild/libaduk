<script>
  import GoBoard from '$lib/game/GoBoard.svelte';
  import { createBoard, placeStones, parseSgf, sgfNodeSetup } from '$lib/game/board';

  let { puzzle } = $props();

  const parsed = parseSgf(puzzle.sgf);
  const setupStones = sgfNodeSetup(parsed.root, parsed.size);
  const board = placeStones(createBoard(parsed.size), setupStones);
  const signMap = board.signMap;
  const size = parsed.size;

  const plProp = parsed.root.props.PL;

  const vertexSize = 12;
  const boardPx = Math.round((size + 0.8) * vertexSize);

  let containerEl = $state(null);
  let scale = $state(1);

  $effect(() => {
    if (!containerEl) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0].contentRect.width;
      scale = width / boardPx;
    });
    observer.observe(containerEl);
    return () => observer.disconnect();
  });
</script>

<a href="/puzzle/{puzzle.id}" class="lobby__puzzle">
  <span class="text">Puzzle of the day</span>
  <div class="lobby__puzzle__board" bind:this={containerEl}>
    <div
      style="transform: scale({scale}); transform-origin: top left; width: {boardPx}px; height: {boardPx}px;"
    >
      <GoBoard {signMap} {size} {vertexSize} interactive={false} />
    </div>
  </div>
  <span class="text">Black to play</span>
</a>
