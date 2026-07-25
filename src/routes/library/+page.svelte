<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import GoBoard from '$lib/game/GoBoard.svelte';
  import { replayMoves, placeStones, createBoard, parseSgfCoords } from '$lib/game/board';
  import { formatOgsRank } from '$lib/lobby/ogsSeekGraph.svelte.js';
  import './library.css';

  let rows = $state({ recent: [], highRanked: [], smallBoard: [], proGames: [] });
  let query = $state('');
  let importError = $state('');
  let limits = $state({ recent: 8, highRanked: 8, smallBoard: 8, proGames: 8 });

  $effect(() => {
    filteredRows;
    limits = { recent: 8, highRanked: 8, smallBoard: 8, proGames: 8 };
  });

  onMount(async () => {
    const res = await fetch('/api/library-games');
    rows = await res.json();
  });

  const looksLikeOgsId = $derived(/^\d+$/.test(query.trim()) || query.includes('online-go.com'));

  const filteredRows = $derived.by(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    function matchesQuery(game) {
      const black = (game.gamedata?.players?.black?.username ?? game.blackName ?? '').toLowerCase();
      const white = (game.gamedata?.players?.white?.username ?? game.whiteName ?? '').toLowerCase();
      const ogsId = parseOgsId(query);
      return black.includes(q) || white.includes(q) || (ogsId && game.ogsGameId === ogsId);
    }
    return {
      recent: rows.recent.filter(matchesQuery),
      highRanked: rows.highRanked.filter(matchesQuery),
      smallBoard: rows.smallBoard.filter(matchesQuery),
      proGames: rows.proGames.filter(matchesQuery)
    };
  });

  function parseOgsId(input) {
    const match = input.match(/(\d+)/);
    return match ? match[1] : null;
  }

  async function importGame() {
    importError = '';
    const ogsGameId = parseOgsId(query);
    if (!ogsGameId) {
      importError = 'Enter a valid OGS game link or ID.';
      return;
    }
    const res = await fetch('/api/game/from-ogs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ogsGameId })
    });
    if (!res.ok) {
      importError = 'Import failed.';
      return;
    }
    const { id } = await res.json();
    goto(`/play/${id}`);
  }

  function boardSize(game) {
    return game.gamedata?.width ?? game.size ?? 19;
  }

  function signMapForGame(game) {
    const size = boardSize(game);
    const packed = game.gamedata?.moves ?? [];
    if (packed.length === 0) {
      return Array.from({ length: size }, () => Array(size).fill(0));
    }
    const moves = packed.map(([x, y]) => (x < 0 ? { type: 'pass' } : { type: 'move', x, y }));
    let initialBoard = null;
    const handicapCoords = parseSgfCoords(game.gamedata?.initial_state?.black ?? '');
    if (handicapCoords.length > 0) {
      const stoneList = handicapCoords.map(([x, y]) => ({ x, y, sign: 1 }));
      initialBoard = placeStones(createBoard(size), stoneList);
    }
    return replayMoves(moves, size, initialBoard).signMap;
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

  function lazyScroll(node, onVisible) {
    const wrap = node.closest('.library__shelf-wrap');
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) onVisible();
      },
      { root: wrap, rootMargin: '400px' }
    );
    observer.observe(node);
    return { destroy: () => observer.disconnect() };
  }

  const SECTIONS = [
    { key: 'recent', title: 'Recently Uploaded' },
    { key: 'highRanked', title: 'High Ranked Games' },
    { key: 'smallBoard', title: '9×9 Games' },
    { key: 'proGames', title: 'Pro Games' }
  ];
</script>

<main id="library">
  <h1 class="library__heading">Game Library</h1>

  <div class="library__search">
    <div class="library__search-wrap">
      <input
        class="library__search-input"
        type="text"
        placeholder="Search games or paste an OGS link to import"
        bind:value={query}
        onkeydown={(e) => looksLikeOgsId && e.key === 'Enter' && importGame()}
      />
      {#if looksLikeOgsId}
        <button class="library__search-btn" onclick={importGame}>Import</button>
      {/if}
    </div>
    {#if importError}
      <p class="library__empty">{importError}</p>
    {/if}
  </div>

  {#each SECTIONS as section}
    {@const games = filteredRows[section.key]}
    {@const displayed = games.slice(0, limits[section.key])}
    <section class="library__row">
      <h2 class="library__row-title">{section.title}</h2>
      {#if games.length === 0}
        <p class="library__empty">No games yet.</p>
      {:else}
        <div class="library__shelf-wrap">
          <div class="library__shelf">
            {#each displayed as game}
              {@const size = boardSize(game)}
              <a class="library__card" href="/play/{game.id}?analysis=1">
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
            {#if displayed.length < games.length}
              <div use:lazyScroll={() => (limits[section.key] += 5)}></div>
            {/if}
          </div>
        </div>
      {/if}
    </section>
  {/each}
</main>
