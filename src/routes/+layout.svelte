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
  import './account/account.css';
  import { ogsSeekGraph } from '$lib/lobby/ogsSeekGraph.svelte.js';
  import { getMe, fetchMe } from '$lib/state/user.svelte.js';
  import { pingState } from '$lib/state/ping.svelte.js';
  import { themeState } from '$lib/nav/theme.svelte.js';
  import { boardSettings } from '$lib/nav/boardSettings.svelte.js';
  import { stoneTheme } from '$lib/nav/stoneTheme.svelte.js';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import SiteHeader from '$lib/nav/SiteHeader.svelte';
  import GameSetupModal from '$lib/lobby/GameSetupModal.svelte';
  import { getGuestId } from '$lib/state/guestId.js';

  let { children, data } = $props();

  let setupModal = $state(null);
  let ogsWarningDismissed = $state(false);

  onMount(() => {
    themeState.init();
    boardSettings.init();
    stoneTheme.init();
    pingState.start();
    return () => pingState.stop();
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

<SiteHeader username={getMe()?.username ?? ''} onOpenSetup={openSetup} />

<div id="main-wrap" class:game-page={isGamePage}>
  <main>
    {#await fetchMe()}
    {:then}
      {@render children()}
    {/await}
  </main>
</div>

{#if setupModal}
  <GameSetupModal
    gameType={setupModal}
    creatorName={getMe()?.username || getGuestId()}
    onClose={() => (setupModal = null)}
  />
{/if}
{#if ogsSeekGraph.tokenExpired && !ogsWarningDismissed}
  <div class="ogs-token-warning">
    Your OGS token has expired. Go to <a href="/account/preferences/ogs">OGS Settings</a> to
    reconnect or disable the connection.
    <button class="ogs-token-warning__close" onclick={() => (ogsWarningDismissed = true)}>✕</button>
  </div>
{/if}
