<script>
  import { pingState } from '$lib/ping.svelte.js';
</script>

<a class="status" href="/lag">
  <signal class="q{pingState.lagRating}">
    {#each [1, 2, 3, 4] as bar}
      <i class:off={bar > pingState.lagRating}></i>
    {/each}
  </signal>
  <span class="ping"><em>PING</em><strong>{pingState.ping ?? '?'}</strong><em>ms</em></span>
</a>
