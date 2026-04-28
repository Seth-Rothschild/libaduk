<script>
  import { tick } from 'svelte';

  let {
    username = '',
    messages = [],
    onSend = () => {},
    boardSize = 19,
    onCoordHover = () => {}
  } = $props();

  const COL_LETTERS = 'ABCDEFGHJKLMNOPQRST';

  function parseMessageParts(text) {
    const isCoord = (word) => /^[A-HJ-Ta-hj-t]\d{1,2}$/i.test(word);
    const coordSet = new Set(text.split(' ').filter(isCoord));
    if (coordSet.size === 0) return [{ type: 'text', content: text }];

    const pattern = new RegExp(`(${[...coordSet].join('|')})`);
    return text.split(pattern).map((part, i) => {
      if (i % 2 === 0) return { type: 'text', content: part };
      const x = COL_LETTERS.indexOf(part[0].toUpperCase());
      const y = boardSize - parseInt(part.slice(1));
      return { type: 'coord', content: part, x, y };
    });
  }

  let inputText = $state('');
  let messagesEl = $state(null);

  function sendMessage(text) {
    if (!text.trim()) return;
    onSend(text.trim());
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
    <ol
      class="mchat__messages"
      aria-live="polite"
      aria-label="Kibbitz chat"
      tabindex="0"
      bind:this={messagesEl}
    >
      {#each messages as msg}
        {#if msg.divider}
          <li class="kibbitz-divider">
            <a href="https://online-go.com/game/{msg.gameId}" target="_blank" rel="noopener">
              {msg.blackName ?? 'Black'} vs {msg.whiteName ?? 'White'}
            </a>
          </li>
        {:else}
          <li class:me={msg.user === username}>
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
      placeholder="Chat is local to libaduk only"
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
</style>
