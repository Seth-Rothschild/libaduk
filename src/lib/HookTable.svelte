<script>
	let { games, onJoin } = $props();

	function formatTime(createdAt) {
		const now = Date.now();
		const diff = now - createdAt;
		const seconds = Math.floor(diff / 1000);
		const minutes = Math.floor(seconds / 60);
		const hours = Math.floor(minutes / 60);
		if (seconds < 60) return 'just now';
		if (minutes < 60) return `${minutes}m ago`;
		if (hours < 24) return `${hours}h ago`;
		return new Date(createdAt).toLocaleDateString();
	}

	function formatClock(timeControl) {
		if (!timeControl) return '∞';
		if (timeControl.type === 'correspondence') return 'Corr.';
		if (timeControl.type === 'byoyomi')
			return `${timeControl.initial / 60}+${timeControl.periods}×${timeControl.periodTime}s`;
		if (timeControl.type === 'fischer') return `${timeControl.initial / 60}+${timeControl.increment}`;
		return '∞';
	}
</script>

<style>
	.lobby__tab-empty {
		padding: 1em;
		color: var(--c-font-dim);
	}
</style>

{#if games.length === 0}
	<p class="lobby__tab-empty">No open games.</p>
{:else}
	<table class="hooks__list">
		<thead>
			<tr>
				<th>Player</th>
				<th>Posted</th>
				<th>Clock</th>
				<th>Board</th>
			</tr>
		</thead>
		<tbody>
			{#each games as game}
				<tr class="hook join" onclick={() => onJoin?.(game.id)}>
					<td>{game.creator}</td>
					<td>{formatTime(game.createdAt)}</td>
					<td>{formatClock(game.timeControl)}</td>
					<td>{game.size}×{game.size}</td>
				</tr>
			{/each}
		</tbody>
	</table>
{/if}
