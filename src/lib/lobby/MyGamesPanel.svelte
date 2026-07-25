<script>
  import GoBoard from '$lib/game/GoBoard.svelte';
  import { replayMoves, placeStones, createBoard, parseSgfCoords } from '$lib/game/board';

  let { games } = $props();

  function moveEntries(game) {
    const packed = game.gamedata?.moves ?? [];
    return packed.map(([x, y]) => (x < 0 ? { type: 'pass' } : { type: 'move', x, y }));
  }

  function boardSize(game) {
    return game.gamedata?.width ?? 19;
  }

  function signMapForGame(game) {
    const size = boardSize(game);
    const moves = moveEntries(game);
    if (moves.length === 0) {
      return Array.from({ length: size }, () => Array(size).fill(0));
    }
    let initialBoard = null;
    const handicapCoords = parseSgfCoords(game.gamedata?.initial_state?.black ?? '');
    if (handicapCoords.length > 0) {
      const stoneList = handicapCoords.map(([x, y]) => ({ x, y, sign: 1 }));
      initialBoard = placeStones(createBoard(size), stoneList);
    }
    return replayMoves(moves, size, initialBoard).signMap;
  }

  function lastMove(game) {
    const last = (game.gamedata?.moves ?? []).at(-1);
    if (!last || last[0] < 0) return null;
    return [last[0], last[1]];
  }
</script>

<div class="my-games-panel">
  {#each games as game}
    <a class="my-game-card" href="/play/{game.id}">
      <div class="my-game-card__board">
        <GoBoard
          signMap={signMapForGame(game)}
          size={boardSize(game)}
          lastMove={lastMove(game)}
          interactive={false}
        />
      </div>
      <div class="my-game-card__info">
        <span class="my-game-card__opponent">{game.opponent ?? 'Waiting...'}</span>
        {#if game.isMyTurn}
          <span class="my-game-card__turn">Your turn</span>
        {/if}
      </div>
    </a>
  {/each}
</div>
