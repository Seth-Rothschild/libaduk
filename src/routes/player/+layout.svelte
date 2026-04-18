<script>
  import { page } from '$app/stores';

  let { children } = $props();
</script>

<main class="page-menu">
  <aside class="page-menu__menu">
    <div class="side sub-ratings">
      <a class:active={$page.url.pathname === '/player'} href="/player">
        <span><h3>Leaderboard</h3></span>
      </a>
      <a class:active={$page.url.pathname === '/player/activity'} href="/player/activity">
        <span><h3>Recent Activity</h3></span>
      </a>
    </div>
  </aside>
  <div class="page-menu__content">
    {@render children()}
  </div>
</main>
