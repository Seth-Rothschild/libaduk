<script>
  import { onDestroy } from 'svelte';
  import PuzzlePage from '../+page.svelte';
  import { resetChips } from '$lib/game/puzzleSession.svelte.js';

  let { data } = $props();

  onDestroy(resetChips);
</script>

{#key data.puzzle.id}
  <PuzzlePage {data} />
{/key}
