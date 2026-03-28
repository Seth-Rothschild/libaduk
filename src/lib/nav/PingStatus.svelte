<script>
  import { pingState } from '$lib/state/ping.svelte.js';
</script>

<a class="status" href="/lag">
  <span class="ping"><em>PING</em><strong>{pingState.ping ?? '?'}</strong><em>ms</em></span>
  <signal class="q{pingState.lagRating}">
    {#each [1, 2, 3, 4] as bar}
      <i class:off={bar > pingState.lagRating}></i>
    {/each}
  </signal>
</a>
