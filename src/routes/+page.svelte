<script>
  import Lobby from '$lib/lobby/Lobby.svelte';
  let { data } = $props();
</script>

<Lobby {data} />
