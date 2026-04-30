<script>
  import { tick } from 'svelte';

  let {
    username = '',
    messages = [],
    viewers = [],
    onSend = () => {},
    boardSize = 19,
    onCoordHover = () => {}
  } = $props();

  const COL_LETTERS = 'ABCDEFGHJKLMNOPQRST';

  function parseMessageParts(text) {
    const isCoord = (word) => /^[A-HJ-Ta-hj-t]\d{1,2}$/i.test(word);
    const isURL = (word) => /^https?:\/\/\S+$/.test(word);
    const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const matchSet = new Set(text.split(' ').filter((w) => isCoord(w) || isURL(w)));
    if (matchSet.size === 0) return [{ type: 'text', content: text }];

    const pattern = new RegExp(`(${[...matchSet].map(escapeRegex).join('|')})`);
    return text.split(pattern).map((part, i) => {
      if (i % 2 === 0) return { type: 'text', content: part };
      if (isURL(part)) return { type: 'url', content: part };
      const x = COL_LETTERS.indexOf(part[0].toUpperCase());
      const y = boardSize - parseInt(part.slice(1));
      return { type: 'coord', content: part, x, y };
    });
  }

  let inputText = $state('');
  let messagesEl = $state(null);
  let sendFailed = $state(false);

  function formatTime(t) {
    if (!t) return '';
    return new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function filterEmptyDividers(messages) {
    return messages.filter((m, i) => {
      if (!m.divider) return true;
      const next = messages[i + 1];
      return !next || !next.divider;
    });
  }

  const visibleMessages = $derived(filterEmptyDividers(messages));
  const uniqueViewers = $derived([...new Set(viewers)]);

  function sendMessage(text) {
    if (!text.trim()) return;
    const sent = onSend(text.trim());
    if (sent === false) {
      sendFailed = true;
      return;
    }
    sendFailed = false;
    inputText = '';
    scrollToBottom();
  }

  function handleKeydown(e) {
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
      {#each visibleMessages as msg}
        {#if msg.divider}
          <li class="kibbitz-divider">
            <a href="https://online-go.com/game/{msg.gameId}" target="_blank" rel="noopener">
              {msg.blackName ?? 'Black'} vs {msg.whiteName ?? 'White'}
            </a>
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
                {:else}
                  {part.content}
                {/if}
              {/each}
            </t>
          </li>
        {/if}
      {/each}
    </ol>
    <input
      class="mchat__say"
      class:mchat__say--disconnected={sendFailed}
      placeholder={sendFailed ? 'Disconnected — message not sent' : 'Chat is local to libaduk only'}
      aria-label="Kibbitz message"
      bind:value={inputText}
      onkeydown={handleKeydown}
    />
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

  .kibbitz-divider a {
    color: inherit;
    text-decoration: none;
  }

  .kibbitz-divider a:hover {
    text-decoration: underline;
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
