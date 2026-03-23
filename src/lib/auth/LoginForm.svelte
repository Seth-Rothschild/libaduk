<script>
  let { error = '', submitting = false, onSignIn } = $props();
</script>

<main class="auth box box-pad">
  <div class="auth-tabs">
    <a href="/login" class="active">Sign In</a>
    <a href="/signup">Register</a>
  </div>

  <div class="form3">
    {#if error}
      <div class="form-group">
        <p class="error">{error}</p>
      </div>
    {/if}

    <button type="button" class="submit button" disabled={submitting} onclick={onSignIn}>
      {submitting ? 'Signing in…' : 'Sign in with passkey'}
    </button>
  </div>

  <div class="passkey-info">
    <p>
      If you haven't yet, you can choose a username and create a passkey on the <a href="/signup"
        >Register</a
      > tab. This site uses passkeys so we don't have to collect any information about you other than
      your chosen username and a public key associated to your passkey.
    </p>
  </div>
</main>
