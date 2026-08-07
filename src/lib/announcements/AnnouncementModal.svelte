<script>
  import { t } from '$lib/i18n/i18n.svelte.js';
  import { formatTime } from '$lib/format.js';
  import { announcementsUi } from './announcementsUi.svelte.js';
  import { allAnnouncements, renderMarkdown, isExpired } from './announcements.js';

  const EXPIRY_DAYS = 30;
  const DISMISSED_KEY = 'announcements:dismissed';

  function getDismissedIds() {
    const raw = localStorage.getItem(DISMISSED_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  }

  function dismiss(id) {
    const dismissedIds = getDismissedIds();
    dismissedIds.add(id);
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...dismissedIds]));
  }

  let dialog = $state(null);
  let index = $state(0);

  $effect(() => {
    if (announcementsUi.disabled) return;
    const newest = allAnnouncements[0];
    if (!newest || isExpired(newest.date, EXPIRY_DAYS)) return;
    const dismissedIds = getDismissedIds();
    if (dismissedIds.has(newest.id)) return;
    index = 0;
    dialog?.showModal();
  });

  $effect(() => {
    if (!announcementsUi.openRequested) return;
    index = 0;
    dialog?.showModal();
    announcementsUi.clearRequest();
  });

  const current = $derived(allAnnouncements[index]);
  const renderedBody = $derived(current ? renderMarkdown(current.body) : '');

  function close() {
    dialog?.close();
  }

  function onDialogClick(e) {
    if (e.target === e.currentTarget) close();
  }

  function onBodyClick(e) {
    if (e.target.closest('a')) close();
  }

  function closeAndDismiss() {
    if (current) dismiss(current.id);
    close();
  }

  function goBack() {
    index = Math.min(allAnnouncements.length - 1, index + 1);
  }

  function goForward() {
    index = Math.max(0, index - 1);
  }
</script>

{#if current}
  <dialog
    bind:this={dialog}
    class="game-setup announcement-modal"
    onclose={close}
    onclick={onDialogClick}
  >
    <button class="announcement-close-x" onclick={closeAndDismiss} aria-label={t('Dismiss')}
      >✕</button
    >
    <div class="scrollable">
      <h2>{current.title}</h2>
      <p class="announcement-subheading">{current.subtitle}</p>
      <p class="announcement-date">{formatTime(current.date)}</p>

      <div class="setup-content announcement-body" onclick={onBodyClick}>
        {@html renderedBody}
      </div>

      <div class="footer announcement-footer">
        <div class="announcement-nav">
          <button class="announcement-nav-btn" onclick={goForward} disabled={index === 0}>
            ‹ Newer
          </button>
          <span class="announcement-counter">{index + 1} / {allAnnouncements.length}</span>
          <button
            class="announcement-nav-btn"
            onclick={goBack}
            disabled={index === allAnnouncements.length - 1}
          >
            Older ›
          </button>
        </div>
      </div>
    </div>
  </dialog>
{/if}
