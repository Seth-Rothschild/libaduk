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
</script>

<a href="/puzzle/{puzzle.id}" class="lobby__puzzle">
  <span class="text">Puzzle of the day</span>
  <div class="lobby__puzzle__board">
    <GoBoard {signMap} {size} interactive={false} />
  </div>
  <span class="text">Black to play</span>
</a>
