<script>
  import { t } from '$lib/i18n/i18n.svelte.js';
  import { formatTime } from '$lib/format.js';
  import { announcementsUi } from './announcementsUi.svelte.js';

  const EXPIRY_DAYS = 30;
  const DISMISSED_KEY = 'announcements:dismissed';

  const modules = import.meta.glob('./content/*.md', {
    eager: true,
    query: '?raw',
    import: 'default'
  });

  function parseAnnouncement(raw) {
    const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!match) return null;
    const [, frontmatterText, body] = match;
    const frontmatter = {};
    for (const line of frontmatterText.split('\n')) {
      if (!line.trim()) continue;
      const [key, ...rest] = line.split(':');
      frontmatter[key.trim()] = rest.join(':').trim();
    }
    return {
      id: frontmatter.id,
      title: frontmatter.title,
      subtitle: frontmatter.subtitle,
      date: frontmatter.date,
      body: body.trim()
    };
  }

  function isExpired(dateString) {
    const ageMs = Date.now() - new Date(dateString).getTime();
    const expiryMs = EXPIRY_DAYS * 24 * 60 * 60 * 1000;
    return ageMs > expiryMs;
  }

  function getDismissedIds() {
    const raw = localStorage.getItem(DISMISSED_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  }

  function dismiss(id) {
    const dismissedIds = getDismissedIds();
    dismissedIds.add(id);
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...dismissedIds]));
  }

  function escapeHtml(text) {
    return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  }

  function renderInline(text) {
    const escaped = escapeHtml(text);
    const withLinks = escaped.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
    const withBold = withLinks.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    return withBold.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  }

  function renderBlock(block) {
    const headerMatch = block.match(/^(#{1,3}) (.*)$/);
    if (headerMatch) {
      const level = headerMatch[1].length + 2;
      return `<h${level}>${renderInline(headerMatch[2])}</h${level}>`;
    }
    const lines = block.split('\n');
    const isList = lines.every((line) => line.startsWith('- '));
    if (isList) {
      const items = lines.map((line) => `<li>${renderInline(line.slice(2))}</li>`).join('');
      return `<ul>${items}</ul>`;
    }
    return `<p>${renderInline(block.replaceAll('\n', ' '))}</p>`;
  }

  function renderMarkdown(markdown) {
    const blocks = markdown.split('\n\n').filter((block) => block.trim());
    return blocks.map(renderBlock).join('');
  }

  const allAnnouncements = Object.values(modules)
    .map(parseAnnouncement)
    .filter(Boolean)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  let dialog = $state(null);
  let index = $state(0);

  $effect(() => {
    if (announcementsUi.disabled) return;
    const newest = allAnnouncements[0];
    if (!newest || isExpired(newest.date)) return;
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

      <div class="setup-content announcement-body">
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
