<script>
  import { onMount } from 'svelte';
  import GoBoard from '$lib/game/GoBoard.svelte';
  import { replayMoves, placeStones, createBoard } from '$lib/game/board';

  let { data } = $props();

  let isOnline = $state(false);

  async function checkOnline() {
    const res = await fetch('/api/players/online');
    const result = await res.json();
    const onlineSet = new Set(result.users);
    isOnline = onlineSet.has(data.profile.username);
  }

  onMount(() => {
    checkOnline();
    const id = setInterval(checkOnline, 10000);
    return () => clearInterval(id);
  });

  function formatClock(timeControl) {
    if (!timeControl || timeControl.type === 'none') return '∞';
    if (timeControl.type === 'correspondence') {
      const days = timeControl.days ?? 3;
      return days === 1 ? '1 day' : `${days} days`;
    }
    if (timeControl.type === 'byoyomi')
      return `${timeControl.initial / 60}+${timeControl.periods}×${timeControl.periodTime}s`;
    if (timeControl.type === 'fischer')
      return `${timeControl.initial / 60}+${timeControl.increment}`;
    return '∞';
  }

  function formatDate(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }

  function resultClass(game) {
    if (!game.winner) return '';
    const username = data.profile.username;
    const myColor = game.blackName === username ? 'black' : 'white';
    if (game.winner === myColor) return 'win';
    return 'loss';
  }

  function resultText(game) {
    if (game.status === 'playing') return 'Playing';
    if (game.status === 'waiting') return 'Waiting';
    if (game.status === 'cancelled') return 'Cancelled';
    if (game.status === 'abandoned') return 'Abandoned';
    if (!game.result) return '';

    const raw = game.result;
    const color = raw.startsWith('B') ? 'Black' : 'White';
    const suffix = raw.slice(2);
    if (suffix === 'R') return `${color} wins by resignation`;
    if (suffix === 'T') return `${color} wins on time`;
    return `${color} wins by ${suffix}`;
  }

  function gameLabel(timeControl) {
    if (!timeControl || timeControl.type === 'none') return 'Unlimited';
    if (timeControl.type === 'correspondence') return 'Correspondence';
    const mins = (timeControl.initial ?? 0) / 60;
    if (mins <= 3) return 'Bullet';
    if (mins <= 10) return 'Blitz';
    if (mins <= 30) return 'Rapid';
    return 'Classical';
  }

  function gameIcon(timeControl) {
    if (!timeControl || timeControl.type === 'none') return '\ue04e';
    if (timeControl.type === 'correspondence') return '\ue019';
    const mins = (timeControl.initial ?? 0) / 60;
    if (mins <= 3) return '\ue032';
    if (mins <= 10) return '\ue008';
    if (mins <= 30) return '\ue002';
    return '\ue00a';
  }

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

  function formatMoveCoord(move) {
    if (move.type === 'pass') return 'pass';
    const col = String.fromCharCode(97 + move.x);
    return `${col}${move.y + 1}`;
  }

  function formatOpeningMoves(moves) {
    if (!moves || moves.length === 0) return '';
    const pairs = [];
    for (let i = 0; i < moves.length && pairs.length < 3; i += 2) {
      const black = formatMoveCoord(moves[i]);
      const white = i + 1 < moves.length ? formatMoveCoord(moves[i + 1]) : null;
      const pair = white !== null ? `${black} ${white}` : black;
      pairs.push(`${pairs.length + 1}. ${pair}`);
    }
    const preview = pairs.join(' ');
    if (moves.length > 6) return `${preview} ... ${moves.length} moves`;
    return preview;
  }

  function isGuest(name) {
    return name === 'Guest' || /^Guest\d{4}$/.test(name);
  }

  function isLinkable(name, gameType) {
    return name && !isGuest(name) && gameType !== 'ogs' && gameType !== 'ai';
  }

  function miniVertexSize(boardGridSize) {
    // Target 240px wide so all boards fill roughly the same space.
    // GoBoard formula: boardSize = (gridSize + 0.8) * vertexSize
    return Math.floor(240 / (boardGridSize + 0.8));
  }

  const CATEGORIES = [
    { label: 'Bullet', icon: '\ue032', match: (tc) => isLive(tc) && tcMins(tc) <= 3 },
    {
      label: 'Blitz',
      icon: '\ue008',
      match: (tc) => isLive(tc) && tcMins(tc) > 3 && tcMins(tc) <= 10
    },
    {
      label: 'Rapid',
      icon: '\ue002',
      match: (tc) => isLive(tc) && tcMins(tc) > 10 && tcMins(tc) <= 30
    },
    {
      label: 'Classical',
      icon: '\ue00a',
      match: (tc) => isLive(tc) && tcMins(tc) > 30
    },
    {
      label: 'Correspondence',
      icon: '\ue019',
      match: (tc) => tc?.type === 'correspondence'
    }
  ];

  function isLive(tc) {
    return tc && (tc.type === 'byoyomi' || tc.type === 'fischer');
  }

  function tcMins(tc) {
    return (tc?.initial ?? 0) / 60;
  }

  let activeCategory = $state(null);
  let activeResult = $state('all');
  let view = $state('games');

  function utcDayKey(ts) {
    const d = new Date(ts);
    return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
  }

  function utcDayStart(ts) {
    const d = new Date(ts);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  }

  function formatDayLabel(ts) {
    return new Date(ts).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC'
    });
  }

  function myGameColor(game) {
    const name = data.profile.username;
    const ogsName = data.profile.ogs?.username;
    if (game.blackName === name || game.blackName === ogsName) return 'black';
    return 'white';
  }

  function gameWon(game) {
    return game.winner === myGameColor(game);
  }

  const timeline = $derived(buildTimeline(data.games, data.attempts));

  function buildTimeline(games, attempts) {
    const dayMap = new Map();

    for (const game of games.filter((g) => g.status === 'finished')) {
      const ts = game.endedAt ?? game.createdAt;
      const key = utcDayKey(ts);
      if (!dayMap.has(key))
        dayMap.set(key, { ts: utcDayStart(ts), categories: new Map(), puzzles: [] });
      const day = dayMap.get(key);
      const label = gameLabel(game.timeControl);
      if (!day.categories.has(label))
        day.categories.set(label, { label, icon: gameIcon(game.timeControl), games: [] });
      day.categories.get(label).games.push(game);
    }

    for (const attempt of attempts) {
      const key = utcDayKey(attempt.attemptedAt);
      if (!dayMap.has(key))
        dayMap.set(key, {
          ts: utcDayStart(attempt.attemptedAt),
          categories: new Map(),
          puzzles: []
        });
      dayMap.get(key).puzzles.push(attempt);
    }

    return [...dayMap.values()].sort((a, b) => b.ts - a.ts);
  }

  function gameOpponent(game) {
    return myGameColor(game) === 'black' ? game.whiteName : game.blackName;
  }

  const categoryCounts = $derived(
    CATEGORIES.map((cat) => ({
      ...cat,
      count: data.games.filter((g) => cat.match(g.timeControl)).length
    }))
  );

  const categoryGames = $derived(
    activeCategory === null
      ? data.games
      : data.games.filter((g) => activeCategory.match(g.timeControl))
  );

  const totalGames = $derived(categoryGames.length);
  const wins = $derived(
    categoryGames.filter((g) => {
      const myColor = g.blackName === data.profile.username ? 'black' : 'white';
      return g.winner === myColor;
    }).length
  );
  const losses = $derived(
    categoryGames.filter((g) => {
      const myColor = g.blackName === data.profile.username ? 'black' : 'white';
      return g.winner && g.winner !== myColor;
    }).length
  );

  const visibleGames = $derived(
    categoryGames.filter((g) => {
      if (activeResult === 'wins') {
        const myColor = g.blackName === data.profile.username ? 'black' : 'white';
        return g.winner === myColor;
      }
      if (activeResult === 'losses') {
        const myColor = g.blackName === data.profile.username ? 'black' : 'white';
        return g.winner && g.winner !== myColor;
      }
      return true;
    })
  );
</script>

<main class="page-menu">
  <aside class="page-menu__menu">
    <div class="side sub-ratings">
      {#each categoryCounts as cat}
        <a
          data-icon={cat.icon}
          class:empty={cat.count === 0}
          class:active={activeCategory === cat}
          href={null}
          onclick={() => {
            activeCategory = activeCategory === cat ? null : cat;
            activeResult = 'all';
          }}
        >
          <span>
            <h3>{cat.label}</h3>
            <strong>{cat.count} games</strong>
          </span>
        </a>
      {/each}
    </div>
  </aside>

  <div class="page-menu__content box user-show">
    <div class="box__top user-show__header">
      <h1>
        <span class={isOnline ? 'connected' : 'disconnected'} data-icon="&#xe06b"></span>
        {data.profile.username}
      </h1>
    </div>

    <div class="angles number-menu number-menu--tabs">
      <span
        class="nm-item to-games"
        class:active={view === 'games'}
        onclick={() => (view = 'games')}
      >
        {totalGames} Games
      </span>
      <span class="nm-item" class:active={view === 'timeline'} onclick={() => (view = 'timeline')}>
        Timeline
      </span>
    </div>

    {#if view === 'games'}
      <div class="number-menu number-menu--tabs" id="games">
        <span
          class="nm-item"
          class:active={activeResult === 'all'}
          onclick={() => (activeResult = 'all')}>All</span
        >
        <span
          class="nm-item"
          class:active={activeResult === 'wins'}
          onclick={() => (activeResult = 'wins')}><strong>{wins}</strong> Wins</span
        >
        <span
          class="nm-item"
          class:active={activeResult === 'losses'}
          onclick={() => (activeResult = 'losses')}><strong>{losses}</strong> Losses</span
        >
      </div>

      <div class="games">
        {#each visibleGames as game}
          {@const size = game.size ?? 19}
          <article class="game-row">
            <a class="game-row__overlay" href="/play/{game.id}"></a>
            <div class="game-row__board mini-board" style="margin-right: 14px;">
              <GoBoard signMap={signMapForGame(game)} {size} vertexSize={miniVertexSize(size)} />
            </div>
            <div class="game-row__infos">
              <div class="header" data-icon={gameIcon(game.timeControl)}>
                <div class="header__text">
                  <strong
                    >{formatClock(game.timeControl)} • {gameLabel(game.timeControl)} • {game.size} x {game.size}</strong
                  >
                  <span>{formatDate(game.createdAt)}</span>
                </div>
              </div>
              <div class="versus">
                <div class="player white">
                  {#if isLinkable(game.whiteName, game.gameType)}
                    <a href="/profile/{game.whiteName}">{game.whiteName}</a>
                  {:else}
                    <span>{game.whiteName ?? 'Guest'}</span>
                  {/if}
                </div>
                <div class="swords" data-icon="&#xe033;"></div>
                <div class="player black">
                  {#if isLinkable(game.blackName, game.gameType)}
                    <a href="/profile/{game.blackName}">{game.blackName}</a>
                  {:else}
                    <span>{game.blackName ?? 'Guest'}</span>
                  {/if}
                </div>
              </div>
              <div class="result">
                <span class={resultClass(game)}>{resultText(game)}</span>
              </div>
              <div class="opening">
                <!-- <strong>{size}×{size}</strong> -->
                <div class="pgn">{formatOpeningMoves(game.moves)}</div>
              </div>
            </div>
          </article>
        {:else}
          <div class="no-games">No games yet.</div>
        {/each}
      </div>
    {/if}

    {#if view === 'timeline'}
      <div class="activity">
        {#each timeline as day}
          <section>
            <h2>
              <time datetime={new Date(day.ts).toISOString()} title={formatDayLabel(day.ts)}>
                {formatDayLabel(day.ts)}
              </time>
            </h2>
            <div class="entries">
              {#if day.puzzles.length > 0}
                {@const successes = day.puzzles.filter((p) => p.result === 'success').length}
                {@const failures = day.puzzles.filter((p) => p.result === 'failure').length}
                <div class="entry">
                  <i data-icon="&#xe00c;"></i>
                  <div>
                    Solved {day.puzzles.length}
                    {day.puzzles.length === 1 ? 'tactical puzzle' : 'tactical puzzles'}
                  </div>
                  <score>
                    {#if successes > 0}<win
                        ><strong>{successes}</strong> {successes === 1 ? 'win' : 'wins'}</win
                      >{/if}
                    {#if failures > 0}<loss
                        ><strong>{failures}</strong> {failures === 1 ? 'loss' : 'losses'}</loss
                      >{/if}
                  </score>
                </div>
              {/if}
              {#each day.categories.values() as cat}
                {@const wins = cat.games.filter((g) => gameWon(g)).length}
                {@const losses = cat.games.filter((g) => !gameWon(g)).length}
                <div class="entry">
                  <i data-icon={cat.icon}></i>
                  <div>
                    Played {cat.games.length}
                    {cat.label}
                    {cat.games.length === 1 ? 'game' : 'games'}
                    <div class="sub">
                      {#each cat.games as game}
                        {@const opponent = gameOpponent(game)}
                        {@const won = gameWon(game)}
                        <a href="/play/{game.id}">{won ? 'Victory' : 'Defeat'}</a>
                        {' vs '}
                        {#if isLinkable(opponent, game.gameType)}
                          <a href="/profile/{opponent}">{opponent}</a>
                        {:else}
                          {opponent ?? 'Guest'}
                        {/if}
                        <br />
                      {/each}
                    </div>
                  </div>
                  <score>
                    {#if wins > 0}<win><strong>{wins}</strong> {wins === 1 ? 'win' : 'wins'}</win
                      >{/if}
                    {#if losses > 0}<loss
                        ><strong>{losses}</strong> {losses === 1 ? 'loss' : 'losses'}</loss
                      >{/if}
                  </score>
                </div>
              {/each}
            </div>
          </section>
        {:else}
          <div class="no-games">No activity yet.</div>
        {/each}
      </div>
    {/if}
  </div>
</main>
