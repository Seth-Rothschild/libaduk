<script>
  let {
    playersOnline = 0,
    gamesInPlay = 0,
    onCreateGame,
    onChallengeFriend,
    onPlayLocally
  } = $props();
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
