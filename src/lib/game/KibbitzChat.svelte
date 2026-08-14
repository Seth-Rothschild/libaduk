<script>
  import { tick, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';

  let {
    username = '',
    messages = [],
    viewers = [],
    onSend = () => {},
    boardSize = 19,
    onCoordHover = () => {},
    inputText = $bindable('')
  } = $props();

  const COL_LETTERS = 'ABCDEFGHJKLMNOPQRST';

  function parseTextSegment(text) {
    const isCoord = (word) => /^[A-HJ-Ta-hj-t]\d{1,2}$/i.test(word);
    const isURL = (word) => /^https?:\/\/\S+$/.test(word);
    const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const matchSet = new Set(text.split(' ').filter((w) => isCoord(w) || isURL(w)));
    if (matchSet.size === 0) return text ? [{ type: 'text', content: text }] : [];

    const pattern = new RegExp(`(${[...matchSet].map(escapeRegex).join('|')})`);
    return text
      .split(pattern)
      .filter((part) => part)
      .map((part, i) => {
        if (i % 2 === 0) return { type: 'text', content: part };
        if (isURL(part)) return { type: 'url', content: part };
        const x = COL_LETTERS.indexOf(part[0].toUpperCase());
        const y = boardSize - parseInt(part.slice(1));
        return { type: 'coord', content: part, x, y };
      });
  }

  function parseMessageParts(text) {
    // Mentions are inserted by the autocomplete picker as @[username], since usernames
    // can contain spaces (e.g. accounts created via OGS login end in " (OGS)").
    const segments = text.split(/@\[([^\]]+)\]/);
    return segments.flatMap((segment, i) =>
      i % 2 === 1
        ? [{ type: 'mention', content: `@${segment}`, username: segment }]
        : parseTextSegment(segment)
    );
  }

  let textareaEl = $state(null);
  let mentionQuery = $state(null);
  let mentionStart = $state(0);
  let mentionResults = $state([]);
  let mentionIndex = $state(0);
  let mentionTimer = null;

  onDestroy(() => clearTimeout(mentionTimer));

  function closeMentions() {
    mentionQuery = null;
    mentionResults = [];
  }

  function detectMention(text, cursorPos) {
    const upToCursor = text.slice(0, cursorPos);
    const match = /(^|\s)@([a-zA-Z0-9_-]{0,30})$/.exec(upToCursor);
    if (!match) return null;
    return { start: match.index + match[1].length, query: match[2] };
  }

  function handleInput(e) {
    const detected = detectMention(inputText, e.target.selectionStart);
    if (!detected) {
      closeMentions();
      return;
    }
    mentionQuery = detected.query;
    mentionStart = detected.start;
    mentionIndex = 0;
    clearTimeout(mentionTimer);
    mentionTimer = setTimeout(async () => {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(mentionQuery)}`);
      mentionResults = await res.json();
    }, 150);
  }

  function selectMention(user) {
    const cursorPos = mentionStart + 1 + mentionQuery.length;
    const mentionToken = `@[${user.username}] `;
    inputText = inputText.slice(0, mentionStart) + mentionToken + inputText.slice(cursorPos);
    const newCursorPos = mentionStart + mentionToken.length;
    closeMentions();
    tick().then(() => {
      textareaEl?.focus();
      textareaEl?.setSelectionRange(newCursorPos, newCursorPos);
    });
  }

  const mountTime = Date.now();

  let messagesEl = $state(null);
  let sendFailed = $state(false);
  let importingGameId = $state(null);

  async function importOgsGame(ogsGameId) {
    importingGameId = ogsGameId;
    try {
      const res = await fetch('/api/game/from-ogs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ogsGameId })
      });
      if (!res.ok) {
        window.open(`https://online-go.com/game/${ogsGameId}`, '_blank', 'noopener');
        return;
      }
      const { id } = await res.json();
      goto(`/play/${id}`);
    } catch {
      window.open(`https://online-go.com/game/${ogsGameId}`, '_blank', 'noopener');
    } finally {
      importingGameId = null;
    }
  }

  function formatTime(t) {
    if (!t) return '';
    const date = new Date(t);
    const datePart = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    const timePart = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `[${datePart}] ${timePart}`;
  }

  function filterEmptyDividers(messages) {
    return messages.filter((m, i) => {
      if (!m.divider) return true;
      if (m.t >= mountTime) return true;
      const next = messages[i + 1];
      return !next || !next.divider;
    });
  }

  const visibleMessages = $derived(filterEmptyDividers(messages));
  const uniqueViewers = $derived([...new Set(viewers)]);
  const userHasPosted = $derived(
    username && visibleMessages.some((m) => !m.divider && m.user === username)
  );

  function sendMessage(text) {
    if (!text.trim()) return;
    const sent = onSend(text.trim());
    if (sent === false) {
      sendFailed = true;
      return;
    }
    sendFailed = false;
    inputText = '';
    closeMentions();
    scrollToBottom();
  }

  function handleKeydown(e) {
    if (mentionResults.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        mentionIndex = (mentionIndex + 1) % mentionResults.length;
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        mentionIndex = (mentionIndex - 1 + mentionResults.length) % mentionResults.length;
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        selectMention(mentionResults[mentionIndex]);
        return;
      }
      if (e.key === 'Escape') {
        closeMentions();
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputText);
    }
  }

  async function scrollToBottom() {
    await tick();
    if (messagesEl) {
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }
  }

  $effect(() => {
    if (messages.length) {
      scrollToBottom();
    }
  });
</script>

<section class="mchat">
  <div class="mchat__content">
    <header class="mchat__viewers">
      <span class="mchat__viewers-count">{uniqueViewers.length} watching</span>
      <ul class="mchat__viewers-list">
        {#each uniqueViewers as viewer}
          <li>{viewer}</li>
        {/each}
      </ul>
    </header>
    <ol
      class="mchat__messages"
      aria-live="polite"
      aria-label="Kibbitz chat"
      tabindex="0"
      bind:this={messagesEl}
    >
      {#if username && !userHasPosted}
        <p class="mchat__empty">You haven't said anything yet — jump in!</p>
      {/if}
      {#each visibleMessages as msg}
        {#if msg.divider}
          <li class="kibbitz-divider">
            <button
              class="kibbitz-link"
              disabled={importingGameId === msg.gameId}
              onclick={() => importOgsGame(msg.gameId)}
            >
              {#if importingGameId === msg.gameId}
                Loading…
              {:else}
                {msg.blackName ?? 'Black'} vs {msg.whiteName ?? 'White'}
              {/if}
              {#if importingGameId !== msg.gameId}<svg
                  class="kibbitz-link__icon"
                  aria-hidden="true"
                  width="11"
                  height="11"
                  viewBox="0 0 11 11"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  ><path d="M4.5 2H2v7h7V6.5" /><path d="M6.5 2H9v2.5" /><line
                    x1="9"
                    y1="2"
                    x2="5"
                    y2="6"
                  /></svg
                >{/if}
            </button>
          </li>
        {:else}
          <li class:me={msg.user === username}>
            <time class="mchat__ts">{formatTime(msg.t)}</time>
            <span class="color">{msg.user}</span>
            <t>
              {#each parseMessageParts(msg.text) as part}
                {#if part.type === 'coord'}
                  <span
                    class="coord-ref"
                    role="img"
                    aria-label={part.content}
                    onmouseenter={() => onCoordHover([part.x, part.y])}
                    onmouseleave={() => onCoordHover(null)}
                    >{part.content}
                  </span>
                {:else if part.type === 'url'}
                  <a href={part.content} target="_blank" rel="noopener">{part.content}</a>
                {:else if part.type === 'mention'}
                  <a class="mention-link" href="/profile/{part.username}">{part.content}</a>
                {:else}
                  {part.content}
                {/if}
              {/each}
            </t>
          </li>
        {/if}
      {/each}
    </ol>
    <div class="mchat__input-wrap">
      <textarea
        class="mchat__say"
        class:mchat__say--disconnected={sendFailed}
        placeholder={sendFailed
          ? 'Disconnected — message not sent'
          : 'Chat  about anything — moves, games, nonsense'}
        aria-label="Kibbitz message"
        bind:value={inputText}
        bind:this={textareaEl}
        oninput={handleInput}
        onkeydown={handleKeydown}
        onblur={closeMentions}></textarea>
      {#if mentionResults.length > 0}
        <div class="search-results mention-results">
          {#each mentionResults as user, i (user.username)}
            <button
              class="search-result"
              class:mention-result-active={i === mentionIndex}
              onmousedown={(e) => e.preventDefault()}
              onclick={() => selectMention(user)}
            >
              {user.username}
            </button>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</section>

<style>
  .kibbitz-divider {
    display: flex;
    align-items: center;
    gap: 0.5em;
    color: var(--c-font-dim);
    font-size: 0.85em;
    text-align: center;
    padding: 0.5em 0;
  }

  .kibbitz-divider::before,
  .kibbitz-divider::after {
    content: '';
    flex: 1;
    border-top: 1px solid var(--c-border);
  }

  .kibbitz-link {
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    color: inherit;
    font: inherit;
    font-size: inherit;
  }

  .kibbitz-link:hover:not(:disabled) {
    text-decoration: underline;
  }

  .kibbitz-link:disabled {
    cursor: default;
    opacity: 0.6;
  }

  .kibbitz-link__icon {
    margin-left: 0.3em;
    vertical-align: middle;
    position: relative;
    top: -0.05em;
  }

  .mchat__viewers {
    display: flex;
    align-items: center;
    gap: 0.75em;
    padding: 0.4em 0.6em;
    border-bottom: 1px solid var(--c-border);
    font-size: 0.85em;
    color: var(--c-font-dim);
    flex-shrink: 0;
  }

  .mchat__viewers-count {
    flex-shrink: 0;
    font-weight: 600;
  }

  .mchat__viewers-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    gap: 0.75em;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .mchat__viewers-list::-webkit-scrollbar {
    display: none;
  }

  .mchat__viewers-list li {
    display: flex;
    align-items: center;
    gap: 0.3em;
    white-space: nowrap;
  }

  .mchat__viewers-list li::before {
    content: '';
    width: 0.5em;
    height: 0.5em;
    border-radius: 50%;
    background: var(--c-success, #4ade80);
    flex-shrink: 0;
  }

  .mchat__empty {
    color: var(--c-font-dim);
    font-size: 0.85em;
    text-align: center;
    padding: 1em;
    margin: 0;
  }

  .mchat__ts,
  .mchat__movenum {
    color: var(--c-font-dim);
    font-size: 0.8em;
    margin-right: 0.25em;
  }

  .mchat__say--disconnected {
    border-color: var(--c-error, #f87171);
  }
</style>
