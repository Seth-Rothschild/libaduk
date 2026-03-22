<script>
  let { error = '', submitting = false, onSignUp } = $props();
  let usernameInput = $state('');

  function handleSubmit(e) {
    e.preventDefault();
    onSignUp(usernameInput);
  }
</script>

<main class="auth auth-signup box box-pad">
  <h1 class="box__top">Sign up</h1>

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

    <button type="submit" class="submit button button-metal big" disabled={submitting}>
      {submitting ? 'Creating account…' : 'Sign up with passkey'}
    </button>
  </form>

  <div class="alternative">
    Already have an account? <a href="/login">Sign in</a>
  </div>
</main>
