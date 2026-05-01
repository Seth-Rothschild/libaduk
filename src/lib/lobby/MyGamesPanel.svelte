<script>
  import GoBoard from '$lib/game/GoBoard.svelte';
  import { replayMoves, placeStones, createBoard } from '$lib/game/board';

  let { games } = $props();

  function signMapForGame(game) {
    const size = game.size ?? 19;
    if (!game.moves || game.moves.length === 0) {
      return Array.from({ length: size }, () => Array(size).fill(0));
    }
    let initialBoard = null;
    if (game.handicapStones?.length > 0) {
      const stoneList = game.handicapStones.map(({ x, y }) => ({ x, y, sign: 1 }));
      initialBoard = placeStones(createBoard(size), stoneList);
    }
    return replayMoves(game.moves, size, initialBoard).signMap;
  }

  function lastMove(moves) {
    const last = moves.at(-1);
    if (!last || last.type === 'pass') return null;
    return [last.x, last.y];
  }
</script>

<div class="my-games-panel">
  {#each games as game}
    <a class="my-game-card" href="/play/{game.id}">
      <div class="my-game-card__board">
        <GoBoard
          signMap={signMapForGame(game)}
          size={game.size ?? 19}
          lastMove={lastMove(game.moves)}
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
