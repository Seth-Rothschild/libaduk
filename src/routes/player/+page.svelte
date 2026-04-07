<script>
  import { onMount } from 'svelte';
  import SiteStats from './SiteStats.svelte';

  let { data } = $props();

  const CATEGORIES = [
    { key: 'bullet', label: 'Bullet', icon: '\ue032' },
    { key: 'blitz', label: 'Blitz', icon: '\ue008' },
    { key: 'rapid', label: 'Rapid', icon: '\ue002' },
    { key: 'classical', label: 'Classical', icon: '\ue00a' },
    { key: 'correspondence', label: 'Correspondence', icon: '\ue019' },
    { key: 'puzzles', label: 'Puzzles', icon: '\ue00c' }
  ];

  let onlineUsers = $state([]);
  let onlineGuests = $state([]);
  let stats = $state(null);

  async function refreshOnline() {
    const res = await fetch('/api/players/online');
    const result = await res.json();
    onlineUsers = result.users;
    onlineGuests = result.guests;
  }

  async function refreshStats() {
    const res = await fetch('/api/stats');
    stats = await res.json();
  }

  onMount(() => {
    refreshOnline();
    refreshStats();
    const id = setInterval(refreshOnline, 10000);
    return () => clearInterval(id);
  });

  const onlineCount = $derived(onlineUsers.length + onlineGuests.length);
  const onlineSet = $derived(new Set(onlineUsers));

  function hasLeaderboardData(leaderboards) {
    for (const cat of CATEGORIES) {
      if (leaderboards[cat.key]?.length > 0) return true;
    }
    return false;
  }
</script>

<main class="page-menu">
  <aside class="page-menu__menu">
    <div class="side sub-ratings">
      <a class="active" href="/player">
        <span>
          <h3>Leaderboard</h3>
        </span>
      </a>
    </div>
  </aside>

  <div class="page-menu__content community">
    <div class="community__online">
      <h2>Online Players</h2>
      <ol class="online-list">
        {#each onlineUsers as username}
          <li>
            <span class="online-dot"></span>
            <a href="/profile/{username}">{username}</a>
          </li>
        {/each}
        {#each onlineGuests as guest}
          <li class="guest">
            <span class="online-dot"></span>
            <span>{guest}</span>
          </li>
        {/each}
      </ol>
      {#if onlineCount === 0}
        <div class="online-empty">No one online right now.</div>
      {/if}
    </div>

    {#if stats}
      <SiteStats {stats} />
    {/if}

    <div class="community__leaders">
      <h2>Leaderboard</h2>
      {#if hasLeaderboardData(data.leaderboards)}
        <div class="leaderboards">
          {#each CATEGORIES as cat}
            {#if data.leaderboards[cat.key]?.length > 0}
              <section class="leaderboard-card">
                <h3 data-icon={cat.icon}>
                  {cat.label}
                </h3>
                <ol>
                  {#each data.leaderboards[cat.key] as player}
                    <li>
                      {#if onlineSet.has(player.username)}
                        <span class="online-dot"></span>
                      {:else}
                        <span class="offline-dot"></span>
                      {/if}
                      <a href="/profile/{player.username}">{player.username}</a>
                      <span class="game-count">{player.count}</span>
                    </li>
                  {/each}
                </ol>
              </section>
            {/if}
          {/each}
        </div>
      {:else}
        <div class="leaderboards-empty">No games played yet. Be the first!</div>
      {/if}
    </div>
  </div>
</main>
