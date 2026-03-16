<script>
  import { goto, invalidateAll } from '$app/navigation';
  import { setUsername } from '$lib/user.svelte.js';
  import { startAuthentication } from '@simplewebauthn/browser';

  let error = $state('');
  let submitting = $state(false);

  async function submit() {
    error = '';
    submitting = true;
    try {
      const optionsRes = await fetch('/api/auth/webauthn/login-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const optionsData = await optionsRes.json();
      if (!optionsRes.ok) {
        error = optionsData.error ?? 'Something went wrong';
        return;
      }

      let authResp;
      try {
        authResp = await startAuthentication({ optionsJSON: optionsData });
      } catch (err) {
        if (err.name === 'NotAllowedError') {
          error = 'Passkey sign-in was cancelled.';
        } else {
          error = err.message ?? 'Passkey sign-in failed.';
        }
        return;
      }

      const verifyRes = await fetch('/api/auth/webauthn/login-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authResp)
      });
      const verifyData = await verifyRes.json();
      if (verifyRes.ok) {
        setUsername(verifyData.username);
        await invalidateAll();
        goto('/');
      } else {
        error = verifyData.error ?? 'Something went wrong';
      }
    } finally {
      submitting = false;
    }
  }
</script>

<main class="auth auth-login box box-pad">
  <h1 class="box__top">Sign in</h1>

  <div class="form3">
    {#if error}
      <div class="form-group">
        <p class="error">{error}</p>
      </div>
    {/if}

    <button
      type="button"
      class="submit button button-metal text"
      disabled={submitting}
      onclick={submit}
    >
      {submitting ? 'Signing in…' : 'Sign in with passkey'}
    </button>
  </div>

  <div class="alternative">
    <a href="/signup">Register</a>
  </div>
</main>
