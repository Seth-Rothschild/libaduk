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
    <a href="/analysis" data-sveltekit-preload-data="off">Tools</a>
    <div role="group">
      <a href="/analysis" data-sveltekit-preload-data="off">Analysis board</a>
    </div>
  </section>
</nav>
