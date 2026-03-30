<script>
  import { enhance } from '$app/forms';

  let { data, form } = $props();

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
</script>

<div class="box__top">
  <h1>Edit Profile</h1>
</div>

<form method="POST" use:enhance>
  <div class="form-group">
    <label class="form-label" for="biography">Biography</label>
    <textarea id="biography" name="biography" class="form-control" rows="5" maxlength="400"
      >{data.biography}</textarea
    >
  </div>

  <div class="form-group">
    <label class="form-label" for="realName">Real Name</label>
    <input
      id="realName"
      name="realName"
      type="text"
      class="form-control"
      value={data.realName}
      maxlength="80"
    />
  </div>

  <div class="form-group">
    <label class="form-label" for="ranking">Estimated Ranking</label>
    <select id="ranking" name="ranking" class="form-control">
      <option value="" selected={data.ranking === ''}>— not set —</option>
      {#each RANKINGS as r}
        <option value={r} selected={data.ranking === r}>{r}</option>
      {/each}
    </select>
  </div>

  {#if form?.error}
    <p class="form-error">{form.error}</p>
  {/if}

  {#if form?.success}
    <p class="form-success">Profile saved.</p>
  {/if}

  <button type="submit" class="button submit">Save profile</button>
</form>
