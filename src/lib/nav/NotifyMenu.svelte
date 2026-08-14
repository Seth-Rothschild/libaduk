<script>
  import { onMount } from 'svelte';
  import { t } from '$lib/i18n/i18n.svelte.js';
  import { formatTime } from '$lib/format.js';
  import { notifications } from '$lib/state/notifications.svelte.js';

  let open = $state(false);
  let menuEl = $state(null);

  const close = () => (open = false);
  const openMenu = () => {
    open = true;
    notifications.markAllRead();
  };
  const toggle = () => (open ? close() : openMenu());

  const closeOnClickAway = (e) => {
    if (open && menuEl && !menuEl.contains(e.target) && e.target.isConnected) {
      close();
    }
  };

  const closeOnEscape = (e) => {
    if (e.key === 'Escape' && open) close();
  };

  onMount(() => {
    notifications.refresh();
  });
</script>

<svelte:window onclick={closeOnClickAway} onkeydown={closeOnEscape} />

<div class="notify" class:shown={open} bind:this={menuEl}>
  <button
    class="toggle link"
    aria-label={t('Notifications')}
    title={t('Notifications')}
    onclick={toggle}
  >
    <span
      class="data-count"
      data-count={notifications.unreadCount}
      data-icon="&#xe06a;"
      role="status"
      aria-label={`${t('Notifications')}: ${notifications.unreadCount}`}
    ></span>
  </button>
  <div class="dropdown">
    <div class="pager prev disabled" data-icon="&#xe031;"></div>
    {#if notifications.items.length === 0}
      <div class="empty text" data-icon="&#xe060;">{t('No notifications.')}</div>
    {:else}
      <button
        class="delete theme-btn"
        data-icon="&#xe04f;"
        title={t('Clear')}
        onclick={() => notifications.clear()}
      ></button>
      <div class="notifications">
        {#each notifications.items as n (n.id)}
          {#if n.type === 'chat-tag'}
            <a
              class="site_notification"
              href={n.isTv ? '/tv' : `/play/${n.gameId}`}
              onclick={close}
            >
              <span class="site_notification__icon" data-icon="&#xe042;"></span>
              <span class="content">
                <span>
                  <strong>{n.from}</strong>
                  <time>{formatTime(n.createdAt)}</time>
                </span>
                <span>{t('mentioned you in chat')}</span>
              </span>
            </a>
          {:else}
            <a class="site_notification" href="/play/{n.gameId}" onclick={close}>
              <span class="site_notification__icon" data-icon="&#xe019;"></span>
              <span class="content">
                <span>
                  <strong>{t('Your move')}</strong>
                  <time>{formatTime(n.createdAt)}</time>
                </span>
                <span>{t('vs')} {n.opponent}</span>
              </span>
            </a>
          {/if}
        {/each}
      </div>
    {/if}
  </div>
</div>
