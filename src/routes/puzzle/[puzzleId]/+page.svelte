<script>
  import PuzzlePage from '../+page.svelte';

  let { data } = $props();
</script>

{#key data.puzzle.id}
  <PuzzlePage {data} />
{/key}
