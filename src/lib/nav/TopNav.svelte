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
    <a href="/tv">Watch</a>
    <div role="group">
      <a href="/tv">TV</a>
    </div>
  </section>
  <section>
    <a href="/player">Community</a>
    <div role="group">
      <a href="/player">Players</a>
      <a href="/player/activity">Activity</a>
      <a href="https://online-go.com/group/16370">OGS Group</a>
      <a href="https://github.com/Seth-Rothschild/libaduk/issues">Github Issues</a>
    </div>
  </section>
  <section>
    <a href="/scratch" data-sveltekit-preload-data="off">Tools</a>
    <div role="group">
      <a href="/scratch" data-sveltekit-preload-data="off">Scratch board</a>
      <a href="/kifu" data-sveltekit-preload-data="off">Create Kifu</a>
      <a href="/import">Import game</a>
    </div>
  </section>
</nav>
