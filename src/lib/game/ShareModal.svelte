<script>
  import QRCode from 'qrcode';

  let { url, onClose } = $props();

  let dialog = $state(null);
  let qrSvg = $state('');

  $effect(() => {
    dialog?.showModal();
  });

  $effect(() => {
    QRCode.toString(url, { type: 'svg', margin: 1 }).then((svg) => {
      qrSvg = svg;
    });
  });
</script>

<dialog bind:this={dialog} class="share-modal" onclose={onClose}>
  <div class="share-modal__content">
    <h2 class="share-modal__title">Share game</h2>
    <div class="share-modal__qr">
      {@html qrSvg}
    </div>
    <p class="share-modal__url">{url}</p>
    <button class="button button-metal" onclick={() => dialog?.close()}>Close</button>
  </div>
</dialog>

<style>
  .share-modal {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 10000;
    padding: 0;
    border: none;
    border-radius: 8px;
    background: var(--c-bg-box);
    color: var(--c-font);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  }

  .share-modal::backdrop {
    background: rgba(0, 0, 0, 0.5);
  }

  .share-modal__content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.8em;
    padding: 1.5em;
  }

  .share-modal__title {
    margin: 0;
    color: var(--c-font-clearer);
  }

  .share-modal__qr {
    background: #fff;
    padding: 0.8em;
    border-radius: 4px;
    line-height: 0;
  }

  .share-modal__qr :global(svg) {
    width: 220px;
    height: 220px;
  }

  .share-modal__url {
    font-size: 0.9em;
    color: var(--c-font-dim, #888);
    word-break: break-all;
    text-align: center;
  }
</style>
