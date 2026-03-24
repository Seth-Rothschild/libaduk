<script>
  import { hasModel, saveModel, getModelSize, deleteModel } from './engine.js';

  const MODEL_URL =
    'https://huggingface.co/kaya-go/kaya/resolve/main/kata1-b28c512nbt-s12043015936-d5616446734/kata1-b28c512nbt-s12043015936-d5616446734.uint8.onnx?download=true';
  const MODEL_NAME = 'kata1-b28c512nbt (uint8)';

  let { onSaved } = $props();

  let modelPresent = $state(false);
  let modelSizeBytes = $state(null);
  let downloading = $state(false);
  let downloadProgress = $state(0);
  let error = $state(null);
  let fileInput = $state(null);

  $effect(() => {
    checkModel();
  });

  async function checkModel() {
    modelPresent = await hasModel();
    if (modelPresent) {
      modelSizeBytes = await getModelSize();
    }
  }

  async function downloadModel() {
    downloading = true;
    downloadProgress = 0;
    error = null;

    try {
      const response = await fetch(MODEL_URL);
      if (!response.ok) throw new Error(`Download failed: ${response.statusText}`);

      const contentLength = response.headers.get('content-length');
      const total = contentLength ? Number(contentLength) : 0;
      const reader = response.body.getReader();
      const chunks = [];
      let received = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
        if (total > 0) {
          downloadProgress = Math.round((received / total) * 100);
        }
      }

      const buffer = new Uint8Array(received);
      let offset = 0;
      for (const chunk of chunks) {
        buffer.set(chunk, offset);
        offset += chunk.length;
      }

      await saveModel(buffer.buffer);
      await checkModel();
      onSaved?.();
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
      const buffer = await file.arrayBuffer();
      await saveModel(buffer);
      await checkModel();
      onSaved?.();
    } catch (err) {
      error = err.message;
    }
  }

  async function handleDelete() {
    error = null;
    try {
      await deleteModel();
      modelPresent = false;
      modelSizeBytes = null;
    } catch (err) {
      error = err.message;
    }
  }

  function formatSize(bytes) {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  }
</script>

<div class="model-manager">
  <h3>AI Model</h3>

  <p class="attribution">
    Models and JS logic created by <a
      href="https://github.com/kaya-go/kaya"
      target="_blank"
      rel="noopener">Kaya</a
    >
    — KataGo ONNX inference engine.
  </p>

  {#if error}
    <div class="model-error">{error}</div>
  {/if}

  {#if modelPresent}
    <div class="model-info">
      <div class="model-row">
        <span class="model-name">{MODEL_NAME}</span>
        {#if modelSizeBytes}
          <span class="model-size">{formatSize(modelSizeBytes)}</span>
        {/if}
      </div>
      <button class="button button-metal delete-btn" onclick={handleDelete}> Delete model </button>
    </div>
  {:else if downloading}
    <div class="download-progress">
      <div class="progress-label">
        {#if downloadProgress > 0}
          Downloading... {downloadProgress}%
        {:else}
          Connecting...
        {/if}
      </div>
      <div class="progress-bar">
        <div class="progress-fill" style="width: {downloadProgress}%"></div>
      </div>
    </div>
  {:else}
    <div class="download-actions">
      <button class="button button-metal download-btn" onclick={downloadModel}>
        Download model
      </button>
      <div class="upload-row">
        <span class="upload-label">or upload an ONNX file:</span>
        <input
          bind:this={fileInput}
          type="file"
          accept=".onnx,.bin"
          onchange={handleFileUpload}
          style="display:none"
        />
        <button class="button button-metal upload-btn" onclick={() => fileInput?.click()}>
          Upload file
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .model-manager {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .model-manager h3 {
    margin: 0;
    font-size: 1rem;
  }

  .attribution {
    margin: 0;
    font-size: 0.85rem;
    color: var(--c-font-dim, #999);
  }

  .attribution a {
    color: var(--c-primary, #88f);
  }

  .model-error {
    background: #c0392b;
    color: white;
    padding: 0.4rem 0.75rem;
    border-radius: 4px;
    font-size: 0.85rem;
  }

  .model-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .model-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex: 1;
  }

  .model-name {
    font-family: monospace;
    font-size: 0.85rem;
  }

  .model-size {
    font-size: 0.8rem;
    color: var(--c-font-dim, #999);
  }

  .delete-btn {
    font-size: 0.8rem;
    padding: 0.3rem 0.6rem;
  }

  .download-actions {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .upload-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.85rem;
    color: var(--c-font-dim, #999);
  }

  .upload-btn {
    font-size: 0.8rem;
    padding: 0.3rem 0.6rem;
  }

  .download-progress {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .progress-label {
    font-size: 0.85rem;
    color: var(--c-font-dim, #999);
  }

  .progress-bar {
    height: 6px;
    background: var(--c-bg-zebra, #333);
    border-radius: 3px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: var(--c-primary, #88f);
    border-radius: 3px;
    transition: width 0.2s ease;
  }
</style>
