<script>
  import { goto, invalidateAll } from '$app/navigation';
  import { fetchMe } from '$lib/state/user.svelte.js';

  import { startRegistration } from '@simplewebauthn/browser';
  import SignupForm from '$lib/auth/SignupForm.svelte';

  let error = $state('');
  let submitting = $state(false);

  async function signUp(username) {
    error = '';
    submitting = true;
    try {
      const optionsRes = await fetch('/api/auth/webauthn/register-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      });
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
          error = 'A passkey is already registered on this device.';
        } else if (err.name === 'NotAllowedError') {
          error = 'Passkey creation was cancelled.';
        } else {
          error = err.message ?? 'Passkey creation failed.';
        }
        return;
      }

      const verifyRes = await fetch('/api/auth/webauthn/register-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(attResp)
      });
      const verifyData = await verifyRes.json();
      if (verifyRes.ok) {
        await fetchMe();
        await invalidateAll();
        goto('/tv');
      } else {
        error = verifyData.error ?? 'Something went wrong';
      }
    } finally {
      submitting = false;
    }
  }
</script>

<SignupForm {error} {submitting} onSignUp={signUp} />
