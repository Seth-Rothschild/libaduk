<script>
  let { error = '', submitting = false, onSignUp } = $props();
  let usernameInput = $state('');

  function handleSubmit(e) {
    e.preventDefault();
    onSignUp(usernameInput);
  }
</script>

<main class="auth auth-signup box box-pad">
  <div class="auth-tabs">
    <a href="/login">Sign In</a>
    <a href="/signup" class="active">Register</a>
  </div>

  <form id="signup-form" class="form3" onsubmit={handleSubmit}>
    <div class="form-group">
      <label class="form-label" for="form3-username">Username</label>
      <input
        id="form3-username"
        name="username"
        type="text"
        class="form-control"
        required
        autofocus
        autocomplete="username"
        bind:value={usernameInput}
      />
      <small class="form-help">
        2–20 characters: letters, numbers, underscores. Choose carefully — you won't be able to
        change it.
      </small>
    </div>

    {#if error}
      <div class="form-group">
        <p class="error">{error}</p>
      </div>
    {/if}

    <button type="submit" class="submit button" disabled={submitting}>
      {submitting ? 'Creating account…' : 'Register with passkey'}
    </button>
  </form>

  <div class="passkey-info">
    <p>
      This site uses <a href="https://simplewebauthn.dev/">Simple WebAuthn</a> for passkeys. Passkeys
      are natively supported by modern browsers. They create "public keys" we store in our database while
      the matching private key stays within your operating system or password manager.
    </p>
    <p>
      The upshot of this is that we don't have to try to store passwords or email addresses
      securely, which is why we use them here.
    </p>
  </div>
</main>
