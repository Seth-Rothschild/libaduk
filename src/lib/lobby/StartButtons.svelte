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
    Play against computer
  </button>

  <div class="lobby__counters">
    <a class="lobby__counter" href="/player">
      <strong>{playersOnline}</strong> players online
    </a>
    <a class="lobby__counter" href="/player">
      <strong>{gamesInPlay}</strong> games in play
    </a>
  </div>
</div>
