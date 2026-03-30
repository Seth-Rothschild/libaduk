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
      scope: 'read'
    });
    window.location.href = `${PUBLIC_OAUTH_AUTH_URL}?${params}`;
  }
</script>

<div class="box__top">
  <h1>Link OGS</h1>
</div>

<section class="security-section">
  <h2>OGS Account</h2>
  <p class="section-desc">
    Link your OGS (online-go.com) account to import your profile information.
  </p>

  {#if data.ogs}
    <ul class="passkey-list">
      <li class="passkey-item">
        <span class="passkey-details">
          <span class="passkey-type">{data.ogs.username}</span>
          <span class="passkey-date">ID: {data.ogs.id}</span>
        </span>
      </li>
    </ul>

    <form method="POST" action="?/disconnect" use:enhance>
      <button type="submit" class="button">Disconnect</button>
    </form>
  {:else}
    <button type="button" class="button" onclick={connectOgs}> Connect OGS Account </button>
  {/if}
</section>
