<script>
  import { onMount } from 'svelte';
  import { formatTime, formatClock } from '$lib/format.js';
  import { formatOgsRank, formatOgsClock } from './ogsSeekGraph.svelte.js';
  import { getMe } from '$lib/state/user.svelte.js';

  let { games, onJoin, ogsChallenges = [], onAcceptOgs } = $props();

  let now = $state(Date.now());
  onMount(() => {
    const id = setInterval(() => {
      now = Date.now();
    }, 1000);
    return () => clearInterval(id);
  });
</script>

{#if games.length === 0 && ogsChallenges.length === 0}
  <p class="lobby__tab-empty">No open games.</p>
{:else}
  <div class="hooks__scroll">
    <table class="hooks__list">
      <thead>
        <tr>
          <th>Player</th>
          <th>Posted</th>
          <th>Clock</th>
          <th>Board</th>
          <th>Ranked</th>
          <th>Name</th>
          <th>Location</th>
        </tr>
      </thead>
      <tbody>
        {#each games as game}
          <tr
            class="hook join"
            tabindex="0"
            role="button"
            onclick={() => onJoin?.(game.id)}
            onkeydown={(e) =>
              (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onJoin?.(game.id))}
          >
            <td>{game.creator}</td>
            <td>{formatTime(game.createdAt, now)}</td>
            <td>{formatOgsClock(game.timeControl)}</td>
            <td>{game.size}×{game.size}</td>
            <td>—</td>
            <td>—</td>
            <td>Libaduk.com</td>
          </tr>
        {/each}
        {#each ogsChallenges as entry}
          {@const isOwn = entry.username === getMe()?.ogs?.username}
          <tr
            class="hook {isOwn ? '' : 'join'}"
            tabindex={isOwn ? -1 : 0}
            role="button"
            onclick={() => !isOwn && onAcceptOgs?.(entry)}
            onkeydown={(e) =>
              !isOwn &&
              (e.key === 'Enter' || e.key === ' ') &&
              (e.preventDefault(), onAcceptOgs?.(entry))}
          >
            <td
              >{entry.username.length > 10 ? entry.username.slice(0, 10) + '…' : entry.username} ({formatOgsRank(
                entry
              )})</td
            >
            <td>{formatTime(entry.created, now)}</td>
            <td>{formatOgsClock(entry.time_control_parameters)}</td>
            <td>{entry.width}×{entry.height}</td>
            <td>{entry.ranked ? 'Yes' : 'No'}</td>
            <td>{entry.name.length > 20 ? entry.name.slice(0, 20) + '…' : entry.name}</td>
            <td>OGS</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}
