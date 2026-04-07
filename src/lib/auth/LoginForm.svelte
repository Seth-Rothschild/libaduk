<script>
  import {
    PUBLIC_OAUTH_AUTH_URL,
    PUBLIC_OAUTH_CLIENT_ID,
    PUBLIC_OAUTH_REDIRECT_URI
  } from '$env/static/public';

  let { error = '', submitting = false, onSignIn } = $props();

  function loginWithOgs() {
    const state = crypto.randomUUID();
    document.cookie = `oauth_state=${state}; path=/; max-age=600`;
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: PUBLIC_OAUTH_CLIENT_ID,
      redirect_uri: PUBLIC_OAUTH_REDIRECT_URI,
      scope: 'read write',
      state
    });
    window.location.href = `${PUBLIC_OAUTH_AUTH_URL}?${params}`;
  }
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

    <div class="oauth-divider">or</div>

    <button type="button" class="submit button ogs-button" onclick={loginWithOgs}>
      Sign in with OGS
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
