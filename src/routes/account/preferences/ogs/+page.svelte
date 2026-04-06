<script>
  import {
    PUBLIC_OAUTH_AUTH_URL,
    PUBLIC_OAUTH_CLIENT_ID,
    PUBLIC_OAUTH_REDIRECT_URI
  } from '$env/static/public';
  import { enhance } from '$app/forms';
  import { getMe, updateMe } from '$lib/state/user.svelte.js';

  let { data } = $props();

  function formatOgsRank(rank) {
    const r = Math.floor(rank);
    if (r < 30) return `${30 - r}k`;
    return `${r - 29}d`;
  }

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
  <p class="section-desc">
    Connecting to an OGS account allows you to see and accept unranked OGS games in the lobby. The
    generated token is stored as ogs_token as a cookie in your browser.
  </p>
  {#if data.ogs}
    <div class="passkey-item">
      <span>{data.ogs.username} ({formatOgsRank(data.ogs.ranking)})</span>
      <span class="passkey-date">ID: {data.ogs.id}</span>
    </div>
    <div class="config-group">
      <h2 class="label">Show OGS games in lobby</h2>
      <group class="radio">
        <div>
          <input
            id="ogs_lobby_no"
            name="showOgsGames"
            type="radio"
            value="no"
            checked={getMe()?.settings?.showOgsGames === false}
            onchange={() => updateMe({ settings: { showOgsGames: false } })}
          />
          <label for="ogs_lobby_no">No</label>
        </div>
        <div>
          <input
            id="ogs_lobby_yes"
            name="showOgsGames"
            type="radio"
            value="yes"
            checked={getMe()?.settings?.showOgsGames !== false}
            onchange={() => updateMe({ settings: { showOgsGames: true } })}
          />
          <label for="ogs_lobby_yes">Yes</label>
        </div>
      </group>
    </div>
    <form method="POST" action="?/disconnect" use:enhance>
      <button type="submit" class="button">Disconnect</button>
    </form>
  {:else}
    <button type="button" class="button" onclick={connectOgs}>Connect OGS Account</button>
  {/if}
</section>
