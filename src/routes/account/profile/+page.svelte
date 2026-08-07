<script>
  import { getMe, updateMe } from '$lib/state/user.svelte.js';

  const RANKINGS = [
    '9d',
    '8d',
    '7d',
    '6d',
    '5d',
    '4d',
    '3d',
    '2d',
    '1d',
    '1k',
    '2k',
    '3k',
    '4k',
    '5k',
    '6k',
    '7k',
    '8k',
    '9k',
    '10k',
    '11k',
    '12k',
    '13k',
    '14k',
    '15k',
    '16k',
    '17k',
    '18k',
    '19k',
    '20k'
  ];

  let biography = $state(getMe()?.biography ?? '');
  let realName = $state(getMe()?.realName ?? '');
  let ranking = $state(getMe()?.ranking ?? '');
  let saved = $state(false);

  async function save() {
    await updateMe({ biography, realName, ranking });
    saved = true;
  }
</script>

<div class="box__top">
  <h1>Edit Profile</h1>
</div>

<form
  onsubmit={(e) => {
    e.preventDefault();
    save();
  }}
>
  <div class="form-group">
    <label class="form-label" for="biography">Biography</label>
    <textarea
      id="biography"
      name="biography"
      class="form-control"
      rows="5"
      maxlength="400"
      bind:value={biography}></textarea>
  </div>

  <div class="form-group">
    <label class="form-label" for="realName">Real Name</label>
    <input
      id="realName"
      name="realName"
      type="text"
      class="form-control"
      bind:value={realName}
      maxlength="80"
    />
  </div>

  <div class="form-group">
    <label class="form-label" for="ranking">Estimated Ranking</label>
    <select id="ranking" name="ranking" class="form-control" bind:value={ranking}>
      <option value="">— not set —</option>
      {#each RANKINGS as r}
        <option value={r}>{r}</option>
      {/each}
    </select>
  </div>

  {#if saved}
    <p class="form-success">Profile saved.</p>
  {/if}

  <button type="submit" class="button submit">Save profile</button>
</form>
