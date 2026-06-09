<script>
  import { onMount } from 'svelte';
  import GoBoard from '$lib/game/GoBoard.svelte';
  import { replayMoves, placeStones, createBoard } from '$lib/game/board';
  import { formatOgsRank } from '$lib/lobby/ogsSeekGraph.svelte.js';
  import './library.css';

  let rows = $state({ highRanked: [], smallBoard: [], close: [] });

  onMount(async () => {
    const res = await fetch('/api/library-games');
    rows = await res.json();
  });

  function boardSize(game) {
    return game.gamedata?.width ?? game.size ?? 19;
  }

  function signMapForGame(game) {
    const size = boardSize(game);
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

  function playerLabel(player, fallback) {
    if (!player) return fallback;
    const rank = formatOgsRank(player);
    return `${player.username ?? fallback} (${rank})`;
  }

  function blackLabel(game) {
    return playerLabel(game.gamedata?.players?.black, game.blackName ?? 'Black');
  }

  function whiteLabel(game) {
    return playerLabel(game.gamedata?.players?.white, game.whiteName ?? 'White');
  }

  const SECTIONS = [
    { key: 'highRanked', title: 'High Ranked Games' },
    { key: 'smallBoard', title: '9×9 Games' },
    { key: 'close', title: 'Close Games' }
  ];
</script>

<main id="library">
  <h1 class="library__heading">Library</h1>

  {#each SECTIONS as section}
    {@const games = rows[section.key]}
    <section class="library__row">
      <h2 class="library__row-title">{section.title}</h2>
      {#if games.length === 0}
        <p class="library__empty">No games yet.</p>
      {:else}
        <div class="library__shelf-wrap">
          <div class="library__shelf">
            {#each games as game}
              {@const size = boardSize(game)}
              <a class="library__card" href="/play/{game.id}">
                <div class="library__card-board">
                  <GoBoard signMap={signMapForGame(game)} {size} interactive={false} />
                </div>
                <div class="library__card-info">
                  <div class="library__card-players">
                    {blackLabel(game)} vs {whiteLabel(game)}
                  </div>
                  <div class="library__card-meta">
                    {size}×{size}{game.result ? ` · ${game.result}` : ''}
                  </div>
                </div>
              </a>
            {/each}
          </div>
        </div>
      {/if}
    </section>
  {/each}
</main>
