<script>
  import {
    PUBLIC_OAUTH_AUTH_URL,
    PUBLIC_OAUTH_CLIENT_ID,
    PUBLIC_OAUTH_REDIRECT_URI
  } from '$env/static/public';
  import { enhance } from '$app/forms';
  import { getMe, updateMe } from '$lib/state/user.svelte.js';

  let { data } = $props();

  let showOGSGames = $state(getMe()?.settings?.showOGSGames ?? true);
  let createOGSGames = $state(getMe()?.settings?.createOGSGames ?? true);

  function formatOgsRank(rank) {
    const r = Math.floor(rank);
    if (r < 30) return `${30 - r}k`;
    return `${r - 29}d`;
  }

  function connectOgs() {
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
            checked={!showOGSGames}
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
            checked={showOGSGames}
            onchange={() => updateMe({ settings: { showOgsGames: true } })}
          />
          <label for="ogs_lobby_yes">Yes</label>
        </div>
      </group>
    </div>

    <div class="config-group">
      <h2 class="label">Create OGS games from quick pairing</h2>
      <group class="radio">
        <div>
          <input
            id="ogs_quickpair_no"
            name="createOGSGames"
            type="radio"
            value="no"
            checked={!createOGSGames}
            onchange={() => updateMe({ settings: { createOGSGames: false } })}
          />
          <label for="ogs_quickpair_no">No</label>
        </div>
        <div>
          <input
            id="ogs_quickpair_yes"
            name="createOGSGames"
            type="radio"
            value="yes"
            checked={createOGSGames}
            onchange={() => updateMe({ settings: { createOGSGames: true } })}
          />
          <label for="ogs_quickpair_yes">Yes</label>
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
