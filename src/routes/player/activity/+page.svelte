<script>
  import './activity.css';

  let { data } = $props();

  const games = $derived(data.activity.games);
  const users = $derived(data.activity.users);
</script>

<div class="activity">
  <section class="activity__section">
    <h2>Completed Games</h2>
    {#if games.length === 0}
      <p class="activity__empty">No games completed in the last 24 hours.</p>
    {:else}
      <ul class="activity__list">
        {#each games as game}
          <li class="activity__row">
            <a href="/play/{game.id}" class="activity__players"
              >{game.blackName} vs {game.whiteName}</a
            >
            <span class="activity__result">{game.result}</span>
            <time class="activity__time">{new Date(game.endedAt).toLocaleString()}</time>
          </li>
        {/each}
      </ul>
    {/if}
  </section>

  <section class="activity__section">
    <h2>New Players</h2>
    {#if users.length === 0}
      <p class="activity__empty">No new players in the last 24 hours.</p>
    {:else}
      <ul class="activity__list">
        {#each users as user}
          <li class="activity__row">
            <a href="/profile/{user.username}" class="activity__players">{user.username}</a>
            <time class="activity__time">{new Date(user.createdAt).toLocaleString()}</time>
          </li>
        {/each}
      </ul>
    {/if}
  </section>
</div>
