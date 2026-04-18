<script>
  let { stats } = $props();
</script>

<div class="community__stats">
  <h2>Site Stats</h2>
  <div class="stats-section">
    <h3>All time</h3>
    <ul class="stats-list">
      <li><strong>{stats.totalPlayers}</strong> registered players</li>
      <li>
        <strong>{stats.completedGames}</strong> completed games
        <ul class="stats-sublist">
          <li><strong>{stats.completedGamesHvH}</strong> human vs. human</li>
          <li><strong>{stats.completedGamesHvAI}</strong> human vs. AI</li>
        </ul>
      </li>
      <li>
        <strong>{stats.completedPuzzles}</strong> puzzles played
      </li>
    </ul>
  </div>
  <div class="stats-section">
    <h3>Last 24 hours</h3>
    <ul class="stats-list">
      <li><strong>{stats.recentPlayers}</strong> new players</li>
      <li><strong>{stats.recentGames}</strong> games played</li>
      {#if stats.recentGame}
        <li>
          Most recent game:
          <a href="/play/{stats.recentGame.id}">
            {new Date(stats.recentGame.endedAt).toLocaleString()}
          </a>
        </li>
      {/if}
    </ul>
  </div>
  <a href="/player/activity">View recent activity</a>
</div>
