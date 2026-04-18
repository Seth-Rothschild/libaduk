<script>
  import { tick } from 'svelte';

  let {
    username = '',
    gameId = '',
    gameStatus = 'waiting',
    messages = $bindable([]),
    initialNote = '',
    onSend = () => {}
  } = $props();

  let activeTab = $state('discussion');
  let inputText = $state('');
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
  const usedPresets = $derived(isGameOver ? usedEndPresets : usedStartPresets);
  const presetsVisible = $derived(
    usedPresets.size < 2 && (gameStatus === 'playing' || gameStatus === 'scoring' || isGameOver)
  );

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
              <t>{msg.text}</t>
            {/if}
          </li>
        {/each}
      </ol>
      <input
        class="mchat__say"
        placeholder="Talk in chat"
        aria-label="Chat message"
        bind:value={inputText}
        onkeydown={handleKeydown}
      />
      {#if presetsVisible}
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
        oninput={saveNote}
      ></textarea>
    </div>
  {/if}
</section>
