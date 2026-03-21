<script>
  let { onCreateGame, onChallengeAFriend } = $props();
</script>

<nav id="topnav" class="hover">
  <section>
    <a href="/">
      <span class="play">Play</span>
      <span class="home">libaduk</span>
    </a>
    <div role="group">
      <button onclick={onCreateGame}>Create a game</button>
      <button onclick={onChallengeAFriend}>Challenge a friend</button>
    </div>
  </section>
  <section>
    <a href="/analysis">Tools</a>
    <div role="group">
      <a href="/analysis">Analysis board</a>
    </div>
  </section>
</nav>
