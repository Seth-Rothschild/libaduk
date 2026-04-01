<script>
  import {
    PUBLIC_OAUTH_AUTH_URL,
    PUBLIC_OAUTH_CLIENT_ID,
    PUBLIC_OAUTH_REDIRECT_URI
  } from '$env/static/public';
  import { enhance } from '$app/forms';

  let { data } = $props();

  function connectOgs() {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: PUBLIC_OAUTH_CLIENT_ID,
      redirect_uri: PUBLIC_OAUTH_REDIRECT_URI,
      scope: 'read write'
    });
    window.location.href = `${PUBLIC_OAUTH_AUTH_URL}?${params}`;
  }
</script>

<div class="box__top">
  <h1>OGS Integration</h1>
</div>

<section class="security-section">
  <h2>OGS Account</h2>
  {#if data.ogs}
    <p>{data.ogs.username} (ID: {data.ogs.id})</p>
    <form method="POST" action="?/disconnect" use:enhance>
      <button type="submit" class="button">Disconnect</button>
    </form>
  {:else}
    <button type="button" class="button" onclick={connectOgs}>Connect OGS Account</button>
  {/if}
</section>
