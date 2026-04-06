<script>
  import { goto, invalidateAll } from '$app/navigation';
  import { fetchMe } from '$lib/state/user.svelte.js';

  import { startAuthentication } from '@simplewebauthn/browser';
  import LoginForm from '$lib/auth/LoginForm.svelte';

  let error = $state('');
  let submitting = $state(false);

  async function signIn() {
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
        await fetchMe();
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

<LoginForm {error} {submitting} onSignIn={signIn} />
