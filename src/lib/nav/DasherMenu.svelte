<script>
  import PingStatus from './PingStatus.svelte';
  import AnnouncementsPane from './AnnouncementsPane.svelte';
  import BackgroundPane from './BackgroundPane.svelte';
  import BoardPane from './BoardPane.svelte';
  import LanguagePane from './LanguagePane.svelte';
  import { t } from '$lib/i18n/i18n.svelte.js';
  import { announcementsUi } from '$lib/announcements/announcementsUi.svelte.js';

  let { username, onSignOut } = $props();

  const signedIn = $derived(username.length > 0);

  let open = $state(false);
  let pane = $state('main');
  let dasherEl = $state(null);

  const close = () => {
    open = false;
    pane = 'main';
  };
  const toggle = () => (open ? close() : (open = true));

  const closeOnClickAway = (e) => {
    if (open && dasherEl && !dasherEl.contains(e.target) && e.target.isConnected) {
      close();
    }
  };

  const closeOnEscape = (e) => {
    if (e.key === 'Escape' && open) {
      close();
    }
  };

  const signOut = () => {
    onSignOut();
    close();
  };

  const showAnnouncements = () => {
    announcementsUi.requestOpen();
    close();
  };
</script>

<svelte:window onclick={closeOnClickAway} onkeydown={closeOnEscape} />

{#if signedIn}
  <div class="dasher" class:shown={open} bind:this={dasherEl}>
    <button id="user_tag" class="link" onclick={toggle}>{username}</button>
    <div class="dropdown">
      {#if pane === 'announcements'}
        <AnnouncementsPane
          onBack={() => (pane = 'main')}
          onOpen={showAnnouncements}
          onClose={close}
        />
      {:else if pane === 'background'}
        <BackgroundPane onBack={() => (pane = 'main')} />
      {:else if pane === 'board'}
        <BoardPane onBack={() => (pane = 'main')} />
      {:else if pane === 'language'}
        <LanguagePane onBack={() => (pane = 'main')} />
      {:else}
        <a class="text profile-link" href="/profile/{username}" onclick={close}>
          <span class="online-dot"></span>
          {t('Profile')}
        </a>
        <a class="text" data-icon="&#xe005;" href="/account/profile" onclick={close}
          >{t('Preferences')}</a
        >
        <button class="text signout" data-icon="&#xe055;" onclick={signOut}>{t('Sign out')}</button>
        <hr />
        <button class="text" data-icon-right="&#xe026;" onclick={() => (pane = 'announcements')}
          >{t('Announcements')}</button
        >
        <button class="text" data-icon-right="&#xe026;" onclick={() => (pane = 'language')}
          >{t('Language')}</button
        >
        <button class="text" data-icon-right="&#xe026;" onclick={() => (pane = 'background')}
          >{t('Background')}</button
        >
        <button class="text" data-icon-right="&#xe026;" onclick={() => (pane = 'board')}
          >{t('Board')}</button
        >
        <hr />
        <PingStatus />
      {/if}
    </div>
  </div>
{:else}
  <div class="signin-or-signup">
    <a href="/signup" class="button button-metal signup">{t('Register')}</a>
    <a href="/login" class="button button-metal">{t('Sign in')}</a>
  </div>
  <div class="dasher" class:shown={open} bind:this={dasherEl}>
    <button
      class="toggle link anon"
      data-icon="&#xe005;"
      aria-label={t('Settings')}
      title={t('Settings')}
      onclick={toggle}
    ></button>
    <div class="dropdown">
      {#if pane === 'announcements'}
        <AnnouncementsPane
          onBack={() => (pane = 'main')}
          onOpen={showAnnouncements}
          onClose={close}
        />
      {:else if pane === 'background'}
        <BackgroundPane onBack={() => (pane = 'main')} />
      {:else if pane === 'board'}
        <BoardPane onBack={() => (pane = 'main')} />
      {:else if pane === 'language'}
        <LanguagePane onBack={() => (pane = 'main')} />
      {:else}
        <button class="text" data-icon-right="&#xe026;" onclick={() => (pane = 'announcements')}
          >{t('Announcements')}</button
        >
        <button class="text" data-icon-right="&#xe026;" onclick={() => (pane = 'board')}
          >{t('Board')}</button
        >
        <button class="text" data-icon-right="&#xe026;" onclick={() => (pane = 'background')}
          >{t('Background')}</button
        >
        <button class="text" data-icon-right="&#xe026;" onclick={() => (pane = 'language')}
          >{t('Language')}</button
        >
      {/if}
      <PingStatus />
    </div>
  </div>
{/if}
