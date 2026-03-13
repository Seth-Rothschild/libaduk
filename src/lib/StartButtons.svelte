<script>
	let { playersOnline = 0, gamesInPlay = 0, onCreateGame, onChallengeFriend, onPlayLocally } =
		$props();
</script>

<div class="lobby__start">
	<button
		class="button button-metal lobby__start__button lobby__start__button--hook"
		onclick={() => onCreateGame?.()}
	>
		Create a game
	</button>
	<button
		class="button button-metal lobby__start__button lobby__start__button--friend"
		onclick={() => onChallengeFriend?.()}
	>
		Challenge a friend
	</button>
	<button
		class="button button-metal lobby__start__button lobby__start__button--ai"
		onclick={() => onPlayLocally?.()}
	>
		Play locally
	</button>

	<div class="lobby__counters">
		<span class="lobby__counter">
			<strong>{playersOnline}</strong> players online
		</span>
		<span class="lobby__counter">
			<strong>{gamesInPlay}</strong> games in play
		</span>
	</div>
</div>

<style>
	.lobby__counters {
		display: flex;
		gap: 1.5em;
		padding: 0.6em 1em;
		font-size: 0.9em;
		color: var(--c-font-dim);
		grid-column: 1 / -1;
	}

	.lobby__counter strong {
		color: var(--c-font);
	}
</style>
