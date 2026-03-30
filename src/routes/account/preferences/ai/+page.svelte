<script>
  import { onMount } from 'svelte';
  import {
    hasModel,
    saveModel,
    getModelSize,
    deleteModel,
    loadEngineSettings,
    saveEngineSettings,
    initEngine,
    dispose,
    isReady
  } from '$lib/ai/engine.js';

  const BUNDLED_MODEL_URL =
    'https://huggingface.co/kaya-go/kaya/resolve/main/kata1-b28c512nbt-s12043015936-d5616446734/kata1-b28c512nbt-s12043015936-d5616446734.uint8.onnx?download=true';

  let modelPresent = $state(false);
  let modelName = $state(null);
  let modelSizeBytes = $state(null);
  let downloading = $state(false);
  let downloadProgress = $state(0);
  let error = $state(null);
  let fileInput = $state(null);

  let threads = $state(1);
  let settingsSaved = $state(false);
  let restarting = $state(false);
  let restartError = $state(null);

  onMount(async () => {
    modelPresent = await hasModel();
    if (modelPresent) {
      modelSizeBytes = await getModelSize();
      modelName = localStorage.getItem('libaduk-ai-model-name') ?? 'kata1-b28c512nbt (uint8)';
    }
    threads = loadEngineSettings().threads;
  });

  async function downloadModel() {
    downloading = true;
    downloadProgress = 0;
    error = null;
    try {
      const response = await fetch(BUNDLED_MODEL_URL);
      if (!response.ok) throw new Error(`Download failed: ${response.statusText}`);
      const total = Number(response.headers.get('content-length') ?? 0);
      const reader = response.body.getReader();
      const chunks = [];
      let received = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
        if (total > 0) downloadProgress = Math.round((received / total) * 100);
      }
      const buffer = new Uint8Array(received);
      let offset = 0;
      for (const chunk of chunks) {
        buffer.set(chunk, offset);
        offset += chunk.length;
      }
      await saveModel(buffer.buffer);
      localStorage.setItem('libaduk-ai-model-name', 'kata1-b28c512nbt (uint8)');
      modelName = 'kata1-b28c512nbt (uint8)';
      modelPresent = true;
      modelSizeBytes = await getModelSize();
    } catch (err) {
      error = err.message;
    }
    downloading = false;
  }

  async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    error = null;
    try {
      await saveModel(await file.arrayBuffer());
      localStorage.setItem('libaduk-ai-model-name', file.name);
      modelName = file.name;
      modelPresent = true;
      modelSizeBytes = await getModelSize();
    } catch (err) {
      error = err.message;
    }
  }

  async function handleDelete() {
    error = null;
    try {
      await deleteModel();
      localStorage.removeItem('libaduk-ai-model-name');
      modelPresent = false;
      modelName = null;
      modelSizeBytes = null;
    } catch (err) {
      error = err.message;
    }
  }

  function saveSettings() {
    saveEngineSettings({ threads });
    settingsSaved = true;
    setTimeout(() => (settingsSaved = false), 2000);
  }

  async function restartEngine() {
    restarting = true;
    restartError = null;
    try {
      dispose();
      await initEngine();
    } catch (err) {
      restartError = err.message;
    }
    restarting = false;
  }

  function formatSize(bytes) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
</script>

<div class="box__top">
  <h1>Computer AI</h1>
</div>

<div class="ai-settings">
  <section class="settings-section">
    <h2>Model</h2>
    <p class="section-note">
      Models run locally in your browser via KataGo ONNX inference. Credit: <a
        href="https://github.com/kaya-go/kaya"
        target="_blank"
        rel="noopener">Kaya</a
      >.
    </p>

    {#if error}
      <div class="error-msg">{error}</div>
    {/if}

    <div class="model-row" class:downloaded={modelPresent}>
      <div class="model-identity">
        <span class="model-name">{modelPresent ? modelName : 'kata1-b28c512nbt (uint8)'}</span>
        {#if modelPresent && modelSizeBytes}
          <span class="model-size">{formatSize(modelSizeBytes)}</span>
        {:else if !modelPresent}
          <span class="model-size">~180 MB</span>
        {/if}
      </div>
      <div class="model-actions">
        {#if modelPresent}
          <span class="active-badge">Active</span>
          <button class="button button-metal" onclick={handleDelete}>Delete</button>
        {:else if downloading}
          <div class="progress-wrap">
            <span class="progress-label">
              {downloadProgress > 0 ? `${downloadProgress}%` : 'Connecting…'}
            </span>
            <div class="progress-bar">
              <div class="progress-fill" style="width: {downloadProgress}%"></div>
            </div>
          </div>
        {:else}
          <button class="button button-metal" onclick={downloadModel}>Download</button>
        {/if}
      </div>
    </div>

    <div class="upload-row">
      <input
        bind:this={fileInput}
        type="file"
        accept=".onnx,.bin"
        onchange={handleFileUpload}
        style="display:none"
      />
      <button class="button button-metal" onclick={() => fileInput?.click()}>
        {modelPresent ? 'Replace with ONNX file' : 'Upload ONNX file'}
      </button>
    </div>
  </section>

  <section class="settings-section">
    <h2>Performance</h2>

    <div class="setting-row">
      <label for="threads">
        <span class="setting-label">Threads</span>
        <span class="setting-hint"
          >CPU threads for inference. Takes effect on next engine start.</span
        >
      </label>
      <input id="threads" type="number" min="1" max="16" bind:value={threads} />
    </div>

    <div class="settings-actions">
      <button class="button button-metal" onclick={saveSettings}>Save</button>
      {#if settingsSaved}<span class="saved-msg">Saved!</span>{/if}
      <button
        class="button button-metal"
        onclick={restartEngine}
        disabled={restarting || !modelPresent}
      >
        {restarting ? 'Restarting…' : 'Restart engine'}
      </button>
      {#if restartError}<span class="error-inline">{restartError}</span>{/if}
    </div>
  </section>
</div>

<style>
  .ai-settings {
    display: flex;
    flex-direction: column;
    gap: 3rem;
    max-width: 680px;
  }

  .settings-section h2 {
    font-size: 1rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--c-font-dim);
    margin: 0 0 1rem;
  }

  .section-note {
    font-size: 0.9rem;
    color: var(--c-font-dim);
    margin: -0.5rem 0 1rem;
  }

  .section-note a {
    color: var(--c-link);
  }

  .error-msg {
    background: var(--c-bad);
    color: white;
    padding: 0.5rem 0.75rem;
    border-radius: 4px;
    font-size: 0.9rem;
    margin-bottom: 0.75rem;
  }

  .model-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.9rem 1rem;
    background: var(--c-bg-box);
    border: 1px solid var(--c-border);
    border-radius: 6px;
    margin-bottom: 0.75rem;
  }

  .model-row.downloaded {
    background: var(--c-bg-zebra);
  }

  .model-identity {
    display: flex;
    align-items: baseline;
    gap: 0.75rem;
  }

  .model-name {
    font-family: monospace;
    font-size: 1rem;
  }

  .model-size {
    font-size: 0.9rem;
    color: var(--c-font-dim);
  }

  .model-actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-shrink: 0;
  }

  .active-badge {
    font-size: 0.85rem;
    font-weight: bold;
    color: var(--c-good);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .upload-row {
    margin-top: 0.25rem;
  }

  .progress-wrap {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.3rem;
    min-width: 120px;
  }

  .progress-label {
    font-size: 0.85rem;
    color: var(--c-font-dim);
  }

  .progress-bar {
    width: 120px;
    height: 5px;
    background: var(--c-bg-page);
    border-radius: 3px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: var(--c-primary);
    border-radius: 3px;
    transition: width 0.2s ease;
  }

  .setting-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 2rem;
    padding: 0.75rem 0;
    border-top: 1px solid var(--c-border);
    border-bottom: 1px solid var(--c-border);
  }

  .setting-row label {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    cursor: default;
  }

  .setting-label {
    font-size: 0.95rem;
  }

  .setting-hint {
    font-size: 0.9rem;
    color: var(--c-font-dim);
  }

  .setting-row input[type='number'] {
    width: 110px;
    padding: 0.4rem 0.5rem;
    background: var(--c-bg-input, var(--c-bg-box));
    border: 1px solid var(--c-border);
    border-radius: 4px;
    color: var(--c-font);
    font-size: 0.95rem;
    text-align: left;
    flex-shrink: 0;
  }

  .settings-actions {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding-top: 1rem;
  }

  .saved-msg {
    font-size: 0.9rem;
    color: var(--c-good);
  }

  .error-inline {
    font-size: 0.9rem;
    color: var(--c-bad);
  }
</style>
