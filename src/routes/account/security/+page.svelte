<script>
  import { startRegistration } from '@simplewebauthn/browser';
  import { invalidateAll } from '$app/navigation';

  let { data } = $props();

  let adding = $state(false);
  let error = $state('');
  let success = $state('');

  function passkeyLabel(transports) {
    if (transports.includes('internal'))
      return 'Platform passkey (Touch ID / Face ID / Windows Hello)';
    if (transports.includes('hybrid')) return 'Cross-device passkey (phone or tablet)';
    if (transports.includes('usb')) return 'Security key (USB)';
    if (transports.includes('nfc')) return 'Security key (NFC)';
    if (transports.includes('ble')) return 'Security key (Bluetooth)';
    return 'Passkey';
  }

  function formatDate(ts) {
    if (!ts) return 'Unknown date';
    return new Date(ts).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  async function addPasskey() {
    error = '';
    success = '';
    adding = true;
    try {
      const optionsRes = await fetch('/api/auth/webauthn/add-options', { method: 'POST' });
      const optionsData = await optionsRes.json();
      if (!optionsRes.ok) {
        error = optionsData.error ?? 'Something went wrong';
        return;
      }

      let attResp;
      try {
        attResp = await startRegistration({ optionsJSON: optionsData });
      } catch (err) {
        if (err.name === 'InvalidStateError') {
          error = 'That passkey is already registered on this account.';
        } else if (err.name === 'NotAllowedError') {
          error = 'Passkey creation was cancelled.';
        } else {
          error = err.message ?? 'Passkey creation failed.';
        }
        return;
      }

      const verifyRes = await fetch('/api/auth/webauthn/add-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(attResp)
      });
      const verifyData = await verifyRes.json();
      if (verifyRes.ok) {
        success = 'Passkey added successfully.';
        await invalidateAll();
      } else {
        error = verifyData.error ?? 'Something went wrong';
      }
    } finally {
      adding = false;
    }
  }
</script>

<div class="box__top">
  <h1>Security</h1>
</div>

<section class="security-section">
  <h2>Passkeys</h2>
  <p class="section-desc">
    Passkeys are how you sign in to Libaduk. They are stored in your operating system or password
    manager — we never see your private key.
  </p>

  {#if data.credentials.length === 0}
    <p class="no-passkeys">No passkeys found. Add one below.</p>
  {:else}
    <ul class="passkey-list">
      {#each data.credentials as cred}
        <li class="passkey-item">
          <span class="passkey-details">
            <span class="passkey-type">{passkeyLabel(cred.transports)}</span>
            <span class="passkey-date">Added {formatDate(cred.createdAt)}</span>
          </span>
        </li>
      {/each}
    </ul>
  {/if}

  {#if error}
    <p class="form-error">{error}</p>
  {/if}

  {#if success}
    <p class="form-success">{success}</p>
  {/if}

  <button class="button" onclick={addPasskey} disabled={adding}>
    {adding ? 'Adding passkey…' : 'Add another passkey'}
  </button>
</section>
