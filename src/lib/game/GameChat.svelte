<script>
  import { tick, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';

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
    typingUsers = new Set(),
    isTv = false
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

  const mountTime = Date.now();
  const uniqueViewers = $derived([...new Set(viewers)]);

  let activeTab = $state('discussion');
  let sendFailed = $state(false);
  let noteText = $state(initialNote);
  let messagesEl = $state(null);
  let usedStartPresets = $state(new Set());
  let usedEndPresets = $state(new Set());
  let noteSaveTimer = null;
  let importingGameId = $state(null);

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
    !isTv &&
      !startPresetsExpired &&
      usedPresets.size < 2 &&
      (gameStatus === 'playing' || gameStatus === 'scoring' || isGameOver)
  );

  const placeholder = $derived.by(() => {
    if (sendFailed) return 'Disconnected — message not sent';
    if (isTv) return 'Chat  about anything — moves, games, nonsense';
    if (readOnly) return 'Chat with viewers · not sent to OGS';
    return 'Please be nice in the chat!';
  });

  function filterEmptyDividers(msgs) {
    return msgs.filter((m, i) => {
      if (!m.divider) return true;
      if (m.t >= mountTime) return true;
      const next = msgs[i + 1];
      return !next || !next.divider;
    });
  }

  const visibleMessages = $derived(filterEmptyDividers(messages));
  const userHasPosted = $derived(
    username && visibleMessages.some((m) => !m.divider && m.user === username)
  );

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
  {#if !isTv}
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
  {/if}

  {#if isTv || activeTab === 'discussion'}
    <div class="mchat__content">
      {#if isTv || uniqueViewers.length > 0}
        <header class="mchat__viewers">
          <span class="mchat__viewers-count">
            {isTv ? `${uniqueViewers.length} watching` : 'In this room: '}
          </span>
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
        aria-label={isTv ? 'Kibbitz chat' : 'Chat messages'}
        tabindex="0"
        bind:this={messagesEl}
      >
        {#if isTv && username && !userHasPosted}
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
            <li class:me={msg.user === username} class:system={msg.system}>
              {#if msg.system}
                {msg.text}
              {:else}
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
              {/if}
            </li>
          {/if}
        {/each}
      </ol>
      {#if typingUsers.size > 0}
        <div class="mchat__typing">{formatTyping(typingUsers)}</div>
      {/if}
      <div class="mchat__input-wrap">
        <textarea
          class="mchat__say"
          class:mchat__say--disconnected={sendFailed}
          {placeholder}
          aria-label={isTv ? 'Kibbitz message' : 'Chat message'}
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
