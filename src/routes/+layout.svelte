<script>
  // import '../app.scss';
  import '$lib/theme.css';
  import '$lib/base.css';
  import '$lib/nav/nav.css';
  import '$lib/lobby/lobby.css';
  import '$lib/game/game.css';
  import '$lib/auth/auth.css';
  import './profile/profile.css';
  import './player/player.css';
  import { setUsername, clearUsername } from '$lib/state/user.svelte.js';
  import { pingState } from '$lib/state/ping.svelte.js';
  import { themeState } from '$lib/nav/theme.svelte.js';
  import { boardSettings } from '$lib/nav/boardSettings.svelte.js';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import SiteHeader from '$lib/nav/SiteHeader.svelte';
  import GameSetupModal from '$lib/lobby/GameSetupModal.svelte';
  import { getGuestId } from '$lib/state/guestId.js';

  let { children, data } = $props();

  const username = $derived(data.user?.username ?? '');
  const displayName = $derived(username || getGuestId());
  let setupModal = $state(null);

  onMount(() => {
    themeState.init();
    boardSettings.init();
    pingState.start();
    return () => pingState.stop();
  });

  $effect(() => {
    if (data.user) setUsername(data.user.username);
    else clearUsername();
  });

  const isGamePage = $derived(
    $page.route.id?.startsWith('/play/') ||
      $page.route.id?.startsWith('/analysis') ||
      $page.route.id?.startsWith('/puzzle')
  );

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
  <GameSetupModal
    gameType={setupModal}
    creatorName={displayName}
    onClose={() => (setupModal = null)}
  />
{/if}
