<script>
  import { t } from '$lib/i18n/i18n.svelte.js';
  import { getMe } from '$lib/state/user.svelte.js';

  let { onClose } = $props();

  const disabledBySetting = !(getMe()?.settings?.createOGSGames ?? true);

  let dialog = $state(null);

  $effect(() => {
    dialog?.showModal();
  });

  function close() {
    dialog?.close();
    onClose();
  }

  function onDialogClick(e) {
    if (e.target === e.currentTarget) close();
  }
</script>

<dialog bind:this={dialog} class="game-setup connect-ogs" onclose={onClose} onclick={onDialogClick}>
  <div class="scrollable">
    <div class="close-button-anchor">
      <button class="close-button" data-icon="" onclick={close} aria-label={t('Close')}></button>
    </div>

    <h2>Quick pairing warning</h2>

    <div class="setup-content">
      <p>
        This site does not have enough players online for quick pairing. We think this message,
        while unpleasant, is less bad than you waiting around forever for a match. Sorry!
      </p>
      {#if disabledBySetting}
        <p>
          You've turned off OGS quick pairing in your account settings. Flip it back on to use this.
        </p>
      {:else}
        <p>
          If you want to use quick pairing you can link an OGS account and the quick pairing button
          will create an unranked game there.
        </p>
      {/if}
    </div>

    <div class="footer">
      <a class="button button-metal" href="/account/preferences/ogs" onclick={close}>
        Connect OGS account
      </a>
    </div>
  </div>
</dialog>
