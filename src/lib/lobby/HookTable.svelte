<script>
  import { formatTime, formatClock } from '$lib/format.js';
  import { formatOgsRank, formatOgsClock } from './ogsSeekGraph.svelte.js';
  import { getMe } from '$lib/state/user.svelte.js';

  let { games, onJoin, ogsChallenges = [], onAcceptOgs } = $props();
</script>

{#if games.length === 0 && ogsChallenges.length === 0}
  <p class="lobby__tab-empty">No open games.</p>
{:else}
  <table class="hooks__list">
    <thead>
      <tr>
        <th>Player</th>
        <th>Posted</th>
        <th>Clock</th>
        <th>Board</th>
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
          <td>{formatTime(game.createdAt)}</td>
          <td>{formatClock(game.timeControl)}</td>
          <td>{game.size}×{game.size}</td>
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
          <td>{entry.username} ({formatOgsRank(entry)})</td>
          <td>—</td>
          <td>{formatOgsClock(entry.time_control_parameters)}</td>
          <td>{entry.width}×{entry.height}</td>
          <td>OGS</td>
        </tr>
      {/each}
    </tbody>
  </table>
{/if}
