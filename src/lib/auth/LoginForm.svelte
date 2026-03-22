<script>
  let { error = '', submitting = false, onSignIn } = $props();
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
      class="submit button button-metal"
      disabled={submitting}
      onclick={onSignIn}
    >
      {submitting ? 'Signing in…' : 'Sign in with passkey'}
    </button>
  </div>

  <div class="alternative">
    <a href="/signup">Register</a>
  </div>
</main>
