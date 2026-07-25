<script>
  import { onMount } from 'svelte';
  import GoBoard from '$lib/game/GoBoard.svelte';
  import { replayMoves, placeStones, createBoard, parseSgfCoords } from '$lib/game/board';
  import { getMe } from '$lib/state/user.svelte.js';

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

  function gameBlackName(game) {
    return game.gamedata?.players?.black?.username ?? null;
  }

  function gameWhiteName(game) {
    return game.gamedata?.players?.white?.username ?? null;
  }

  function gameSize(game) {
    return game.gamedata?.width ?? 19;
  }

  function gameTimeControl(game) {
    return game.gamedata?.time_control ?? null;
  }

  function gameMoves(game) {
    return game.gamedata?.moves ?? [];
  }

  function formatClock(tc) {
    if (!tc || tc.system === 'none') return '∞';
    if (tc.speed === 'correspondence') {
      const days = Math.round((tc.per_move ?? 259200) / 86400);
      return days === 1 ? '1 day' : `${days} days`;
    }
    if (tc.system === 'byoyomi') return `${tc.main_time / 60}+${tc.periods}×${tc.period_time}s`;
    if (tc.system === 'fischer') return `${tc.initial_time / 60}+${tc.time_increment}`;
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
    return game.winner === myGameColor(game) ? 'win' : 'loss';
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

  function gameLabel(tc) {
    if (!tc || tc.system === 'none') return 'Unlimited';
    if (tc.speed === 'correspondence') return 'Correspondence';
    const mins = tcMins(tc);
    if (mins <= 3) return 'Bullet';
    if (mins <= 10) return 'Blitz';
    if (mins <= 30) return 'Rapid';
    return 'Classical';
  }

  function gameIcon(tc) {
    if (!tc || tc.system === 'none') return '\ue04e';
    if (tc.speed === 'correspondence') return '\ue019';
    const mins = tcMins(tc);
    if (mins <= 3) return '\ue032';
    if (mins <= 10) return '\ue008';
    if (mins <= 30) return '\ue002';
    return '\ue00a';
  }

  function signMapForGame(game) {
    const size = gameSize(game);
    const packed = gameMoves(game);
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

  function formatMoveCoord(move) {
    const [x, y] = move;
    if (x < 0) return 'pass';
    const col = String.fromCharCode(97 + x);
    return `${col}${y + 1}`;
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
      match: (tc) => tc?.speed === 'correspondence'
    }
  ];

  function isLive(tc) {
    return tc && (tc.system === 'byoyomi' || tc.system === 'fischer');
  }

  function tcMins(tc) {
    if (!tc) return 0;
    const initialSeconds = tc.system === 'byoyomi' ? tc.main_time : tc.initial_time;
    return (initialSeconds ?? 0) / 60;
  }

  let activeCategory = $state(null);
  let activeResult = $state('all');
  let view = $state('games');
  let deletedGameIds = $state(new Set());

  const isOwnProfile = $derived(getMe()?.username === data.profile.username);
  const serverGames = $derived(data.games.filter((g) => g.gameType !== 'uploaded'));
  const uploadedGames = $derived(
    data.games.filter((g) => g.gameType === 'uploaded' && !deletedGameIds.has(g.id))
  );

  async function deleteUploadedGame(gameId) {
    deletedGameIds = new Set([...deletedGameIds, gameId]);
    await fetch('/api/game/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameId })
    });
  }

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
    const blackName = gameBlackName(game);
    if (blackName === name || blackName === ogsName) return 'black';
    return 'white';
  }

  function gameWon(game) {
    return game.winner === myGameColor(game);
  }

  const timeline = $derived(buildTimeline(serverGames, data.attempts));

  function buildTimeline(games, attempts) {
    const dayMap = new Map();

    for (const game of games.filter((g) => g.status === 'finished')) {
      const ts = game.endedAt ?? game.createdAt;
      const key = utcDayKey(ts);
      if (!dayMap.has(key))
        dayMap.set(key, { ts: utcDayStart(ts), categories: new Map(), puzzles: [] });
      const day = dayMap.get(key);
      const label = gameLabel(gameTimeControl(game));
      if (!day.categories.has(label))
        day.categories.set(label, { label, icon: gameIcon(gameTimeControl(game)), games: [] });
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
    return myGameColor(game) === 'black' ? gameWhiteName(game) : gameBlackName(game);
  }

  const categoryCounts = $derived(
    CATEGORIES.map((cat) => ({
      ...cat,
      count: serverGames.filter((g) => cat.match(g.timeControl)).length
    }))
  );

  const categoryGames = $derived(
    activeCategory === null
      ? serverGames
      : serverGames.filter((g) => activeCategory.match(g.timeControl))
  );

  const totalGames = $derived(categoryGames.length);
  const wins = $derived(categoryGames.filter((g) => gameWon(g)).length);
  const losses = $derived(categoryGames.filter((g) => g.winner && !gameWon(g)).length);

  const visibleGames = $derived(
    categoryGames.filter((g) => {
      if (activeResult === 'wins') return gameWon(g);
      if (activeResult === 'losses') return g.winner && !gameWon(g);
      return true;
    })
  );

  let limit = $state(10);
  const pagedGames = $derived(visibleGames.slice(0, limit));

  $effect(() => {
    activeCategory;
    activeResult;
    view;
    limit = 10;
  });

  let sentinel = $state(null);

  $effect(() => {
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) limit += 10;
      },
      { rootMargin: '800px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  });
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
        <span
          class="nm-item"
          class:active={activeResult === 'imported'}
          onclick={() => (activeResult = 'imported')}
          ><strong>{uploadedGames.length}</strong> Imported</span
        >
      </div>

      <div class="games">
        {#if activeResult === 'imported'}
          {#each uploadedGames as game}
            {@const size = gameSize(game)}
            <article class="game-row">
              <a class="game-row__overlay" href="/play/{game.id}"></a>
              <div class="game-row__board mini-board" style="margin-right: 14px;">
                <GoBoard signMap={signMapForGame(game)} {size} />
              </div>
              <div class="game-row__infos">
                <div class="header">
                  <div class="header__text">
                    <strong>{gameBlackName(game)} vs {gameWhiteName(game)} • {size}×{size}</strong>
                    <span>{formatDate(game.createdAt)}</span>
                  </div>
                </div>
                <div class="result"><span>Imported</span></div>
              </div>
              {#if isOwnProfile}
                <button
                  class="delete-btn"
                  aria-label="Delete imported game"
                  onclick={() => deleteUploadedGame(game.id)}>✕</button
                >
              {/if}
            </article>
          {:else}
            <div class="no-games">No imported games yet.</div>
          {/each}
        {:else}
          {#each pagedGames as game}
            {@const size = gameSize(game)}
            {@const blackName = gameBlackName(game)}
            {@const whiteName = gameWhiteName(game)}
            {@const tc = gameTimeControl(game)}
            <article class="game-row">
              <a class="game-row__overlay" href="/play/{game.id}"></a>
              <div class="game-row__board mini-board" style="margin-right: 14px;">
                <GoBoard signMap={signMapForGame(game)} {size} />
              </div>
              <div class="game-row__infos">
                <div class="header" data-icon={gameIcon(tc)}>
                  <div class="header__text">
                    <strong
                      >{formatClock(tc)} • {gameLabel(tc)} • {size} x
                      {size}</strong
                    >
                    <span>{formatDate(game.createdAt)}</span>
                  </div>
                </div>
                <div class="versus">
                  <div class="player white">
                    {#if isLinkable(whiteName, game.gameType)}
                      <a href="/profile/{whiteName}">{whiteName}</a>
                    {:else}
                      <span>{whiteName ?? 'Guest'}</span>
                    {/if}
                  </div>
                  <div class="swords" data-icon="&#xe033;"></div>
                  <div class="player black">
                    {#if isLinkable(blackName, game.gameType)}
                      <a href="/profile/{blackName}">{blackName}</a>
                    {:else}
                      <span>{blackName ?? 'Guest'}</span>
                    {/if}
                  </div>
                </div>
                <div class="result">
                  <span class={resultClass(game)}>{resultText(game)}</span>
                </div>
                <div class="opening">
                  <div class="pgn">{formatOpeningMoves(gameMoves(game))}</div>
                </div>
              </div>
            </article>
          {:else}
            <div class="no-games">No games yet.</div>
          {/each}
          {#if pagedGames.length < visibleGames.length}
            <div bind:this={sentinel}></div>
          {/if}
        {/if}
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
