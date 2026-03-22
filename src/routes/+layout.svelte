<script>
  // import '../app.scss';
  import '$lib/theme.css';
  import '$lib/base.css';
  import '$lib/nav/nav.css';
  import '$lib/lobby/lobby.css';
  import '$lib/game/game.css';
  import './profile/profile.css';
  import { setUsername, clearUsername } from '$lib/user.svelte.js';
  import { pingState } from '$lib/ping.svelte.js';
  import { themeState } from '$lib/theme.svelte.js';
  import { boardState } from '$lib/boardState.svelte.js';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import SiteHeader from '$lib/nav/SiteHeader.svelte';
  import GameSetupModal from '$lib/lobby/GameSetupModal.svelte';

  let { children, data } = $props();

  const username = $derived(data.user?.username ?? '');
  let setupModal = $state(null);

  onMount(() => {
    themeState.init();
    boardState.init();
    pingState.start();
    return () => pingState.stop();
  });

  $effect(() => {
    if (data.user) setUsername(data.user.username);
    else clearUsername();
  });

  const isGamePage = $derived($page.route.id?.startsWith('/play/') || $page.route.id?.startsWith('/analysis'));

  const openSetup = async (type) => {
    await goto('/');
    setupModal = type;
  };
</script>

<SiteHeader {username} onOpenSetup={openSetup} />

<div id="main-wrap" class:game-page={isGamePage}>
  <main>
    {@render children()}
  </main>
</div>

{#if setupModal}
  <GameSetupModal gameType={setupModal} onClose={() => (setupModal = null)} />
{/if}
