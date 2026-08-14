<script>
  import { tick, onDestroy } from 'svelte';

  let {
    username = '',
    gameId = '',
    gameStatus = 'waiting',
    messages = $bindable([]),
    viewers = [],
    initialNote = '',
    onSend = () => {},
    boardSize = 19,
    onCoordHover = () => {},
    inputText = $bindable(''),
    moveCount = 0,
    readOnly = false,
    typingUsers = new Set()
  } = $props();

  function formatTyping(users) {
    const names = [...users];
    if (names.length === 0) return '';
    if (names.length === 1) return `${names[0]} is typing...`;
    if (names.length === 2) return `${names[0]} and ${names[1]} are typing...`;
    return `${names[0]}, ${names[1]} and others are typing...`;
  }

  const COL_LETTERS = 'ABCDEFGHJKLMNOPQRST';

  function parseIfReviewJson(text) {
    try {
      const parsed = JSON.parse(text);
      if (parsed?.type === 'review' && parsed.review_id) {
        return `https://online-go.com/review/${parsed.review_id}`;
      }
    } catch {
      // not JSON
    }
    return text;
  }

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
    text = parseIfReviewJson(text);
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

  const uniqueViewers = $derived([...new Set(viewers)]);

  let activeTab = $state('discussion');
  let sendFailed = $state(false);
  let noteText = $state(initialNote);
  let messagesEl = $state(null);
  let usedStartPresets = $state(new Set());
  let usedEndPresets = $state(new Set());
  let noteSaveTimer = null;

  const START_PRESETS = [
    { key: 'hi', text: 'Hello' },
    { key: 'gl', text: 'Good luck' },
    { key: 'hf', text: 'Have fun!' },
    { key: 'u2', text: 'You too!' }
  ];

  const END_PRESETS = [
    { key: 'gg', text: 'Good game' },
    { key: 'wp', text: 'Well played' },
    { key: 'ty', text: 'Thank you!' },
    { key: 'gtg', text: "I've got to go" },
    { key: 'bye', text: 'Bye!' }
  ];

  const isGameOver = $derived(
    gameStatus === 'gameover' || gameStatus === 'cancelled' || gameStatus === 'abandoned'
  );
  const activePresets = $derived(isGameOver ? END_PRESETS : START_PRESETS);
  const inSessionUsed = $derived(isGameOver ? usedEndPresets : usedStartPresets);
  const sentPresetKeys = $derived(
    new Set(
      activePresets
        .filter((p) => messages.some((m) => m.user === username && m.text === p.text))
        .map((p) => p.key)
    )
  );
  const usedPresets = $derived(new Set([...inSessionUsed, ...sentPresetKeys]));
  const startPresetsExpired = $derived(!isGameOver && moveCount > 4);
  const presetsVisible = $derived(
    !startPresetsExpired &&
      usedPresets.size < 2 &&
      (gameStatus === 'playing' || gameStatus === 'scoring' || isGameOver)
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

  function sendPreset(preset) {
    if (usedPresets.has(preset.key)) return;
    if (isGameOver) usedEndPresets = new Set([...usedEndPresets, preset.key]);
    else usedStartPresets = new Set([...usedStartPresets, preset.key]);
    sendMessage(preset.text);
  }

  function saveNote() {
    if (!gameId || !username) return;
    clearTimeout(noteSaveTimer);
    noteSaveTimer = setTimeout(() => {
      fetch('/api/game/note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId, text: noteText })
      });
    }, 500);
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
  <div class="mchat__tabs" role="tablist">
    <button
      class="mchat__tab discussion"
      class:mchat__tab-active={activeTab === 'discussion'}
      role="tab"
      onclick={() => (activeTab = 'discussion')}
    >
      <span>Chat room</span>
    </button>
    <button
      class="mchat__tab"
      class:mchat__tab-active={activeTab === 'notes'}
      role="tab"
      onclick={() => (activeTab = 'notes')}
    >
      Notes
    </button>
  </div>

  {#if activeTab === 'discussion'}
    <div class="mchat__content">
      {#if uniqueViewers.length > 0}
        <header class="mchat__viewers">
          <span class="mchat__viewers-count">In this room: </span>
          <ul class="mchat__viewers-list">
            {#each uniqueViewers as viewer}
              <li>{viewer}</li>
            {/each}
          </ul>
        </header>
      {/if}
      <ol
        class="mchat__messages"
        aria-live="polite"
        aria-label="Chat messages"
        tabindex="0"
        bind:this={messagesEl}
      >
        {#each messages as msg}
          <li class:me={msg.user === username} class:system={msg.system}>
            {#if msg.system}
              {msg.text}
            {:else}
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
            {/if}
          </li>
        {/each}
      </ol>
      {#if typingUsers.size > 0}
        <div class="mchat__typing">{formatTyping(typingUsers)}</div>
      {/if}
      <div class="mchat__input-wrap">
        <textarea
          class="mchat__say"
          class:mchat__say--disconnected={sendFailed}
          placeholder={sendFailed
            ? 'Disconnected — message not sent'
            : readOnly
              ? 'Chat with viewers · not sent to OGS'
              : 'Please be nice in the chat!'}
          aria-label="Chat message"
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
      {#if presetsVisible && !readOnly}
        <div class="mchat__presets" role="group" aria-label="Quick messages">
          {#each activePresets as preset}
            <span
              class:disabled={usedPresets.has(preset.key)}
              title={preset.text}
              role="button"
              tabindex={usedPresets.has(preset.key) ? -1 : 0}
              aria-disabled={usedPresets.has(preset.key)}
              onclick={() => sendPreset(preset)}
              onkeydown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  sendPreset(preset);
                }
              }}
            >
              {preset.key}
            </span>
          {/each}
        </div>
      {/if}
    </div>
  {:else if activeTab === 'notes'}
    <div class="mchat__content note">
      <textarea
        placeholder="Type private notes about this game here. Only you can see them."
        bind:value={noteText}
        oninput={saveNote}></textarea>
    </div>
  {/if}
</section>
