<script>
  import { goto, invalidateAll } from '$app/navigation';
  import { fetchMe } from '$lib/state/user.svelte.js';
  import { onMount } from 'svelte';
  import SiteTitle from './SiteTitle.svelte';
  import TopNav from './TopNav.svelte';
  import SearchBar from './SearchBar.svelte';
  import DasherMenu from './DasherMenu.svelte';
  import MobileNav from './MobileNav.svelte';

  let { username, onOpenSetup } = $props();

  let navOpen = $state(false);

  const signOut = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    await fetchMe();
    await invalidateAll();
    goto('/');
  };

  onMount(() => {
    const header = document.querySelector('body > header');
    const onScroll = () => header?.classList.toggle('scrolled', window.scrollY > 0);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  });
</script>

<header>
  <button
    class="hbg"
    aria-label="Menu"
    aria-expanded={navOpen}
    onclick={() => (navOpen = !navOpen)}
  >
    <span class="hbg__in"></span>
  </button>

  <div class="site-title-nav">
    <SiteTitle />
    <TopNav
      onCreateGame={() => onOpenSetup('hook')}
      onChallengeAFriend={() => onOpenSetup('friend')}
      onPlayLocally={() => onOpenSetup('ai')}
    />
  </div>

  <div class="site-buttons">
    <SearchBar />
    <DasherMenu {username} onSignOut={signOut} />
  </div>
</header>

<MobileNav
  open={navOpen}
  onClose={() => (navOpen = false)}
  onCreateGame={() => onOpenSetup('hook')}
  onChallengeAFriend={() => onOpenSetup('friend')}
  onPlayLocally={() => onOpenSetup('ai')}
/>
