<script>
  let { onCreateGame, onChallengeAFriend } = $props();
</script>

<nav id="topnav" class="hover" aria-label="Main">
  <section>
    <a href="/">
      <span class="play">Play</span>
      <span class="home">libaduk.com</span>
    </a>
    <div role="group">
      <button onclick={onCreateGame}>Create a game</button>
      <button onclick={onChallengeAFriend}>Challenge a friend</button>
    </div>
  </section>
  <section>
    <a href="/puzzle">Puzzles</a>
    <div role="group">
      <a href="/puzzle">Random puzzle</a>
      <a href="/puzzle/daily">Puzzle of the day</a>
    </div>
  </section>
  <section>
    <a href="/player">Community</a>
    <div role="group">
      <a href="/player">Players</a>
    </div>
  </section>
  <section>
    <a href="/analysis" data-sveltekit-preload-data="off">Tools</a>
    <div role="group">
      <a href="/analysis" data-sveltekit-preload-data="off">Analysis board</a>
    </div>
  </section>
</nav>
