<script>
  import { onMount } from 'svelte';
  import GoBoard from '$lib/game/GoBoard.svelte';
  import { replayMoves } from '$lib/game/board';

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

  $effect(() => {
    console.log('all games', data.games);
  });

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
    return replayMoves(game.moves, size).signMap;
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
      <a class="nm-item to-games active" href="/profile/{data.profile.username}">
        {totalGames} Games
      </a>
    </div>

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
                {#if game.whiteName && game.gameType !== 'local' && !isGuest(game.whiteName)}
                  <a href="/profile/{game.whiteName}">{game.whiteName}</a>
                {:else}
                  <span>{game.whiteName ?? 'Guest'}</span>
                {/if}
              </div>
              <div class="swords" data-icon="&#xe033;"></div>
              <div class="player black">
                {#if game.blackName && game.gameType !== 'local' && !isGuest(game.blackName)}
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
  </div>
</main>
