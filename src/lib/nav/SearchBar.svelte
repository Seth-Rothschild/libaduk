<script>
  import { onDestroy } from 'svelte';
  import { goto } from '$app/navigation';

  let expanded = $state(false);
  let query = $state('');
  let results = $state([]);
  let inputEl;
  let searchTimer = null;
  let blurTimer = null;
  let clickedIconTimer = null;
  let clickedIcon = false;

  $effect(() => {
    document.body.classList.toggle('clinput', expanded);
    return () => document.body.classList.remove('clinput');
  });

  onDestroy(() => {
    clearTimeout(searchTimer);
    clearTimeout(blurTimer);
    clearTimeout(clickedIconTimer);
  });

  const expand = () => {
    expanded = true;
    inputEl?.focus();
  };

  const onIconClick = (e) => {
    e.preventDefault();
    clickedIcon = true;
    clearTimeout(clickedIconTimer);
    clickedIconTimer = setTimeout(() => {
      clickedIcon = false;
    }, 300);
    expand();
  };

  const onMouseEnter = () => expand();

  const onMouseLeave = () => {
    if (clickedIcon) return;
    if (query.length === 0) expanded = false;
    inputEl?.blur();
  };

  const onBlur = () => {
    blurTimer = setTimeout(() => {
      expanded = false;
      query = '';
      results = [];
    }, 150);
  };

  const onInput = (e) => {
    query = e.target.value;
    clearTimeout(searchTimer);
    if (query.length === 0) {
      results = [];
      return;
    }
    searchTimer = setTimeout(async () => {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`);
      results = await res.json();
    }, 150);
  };

  const onResultClick = (username) => {
    clearTimeout(blurTimer);
    query = '';
    results = [];
    expanded = false;
    goto(`/profile/${username}`);
  };
</script>

<div id="clinput" onmouseenter={onMouseEnter} onmouseleave={onMouseLeave}>
  <button type="button" data-icon="&#xe057;" aria-label="Search" class="link" onclick={onIconClick}
  ></button>
  <input
    type="text"
    spellcheck="false"
    autocomplete="off"
    aria-label="Search"
    placeholder="Search players"
    enterkeyhint="search"
    bind:this={inputEl}
    value={query}
    oninput={onInput}
    onblur={onBlur}
  />
  {#if results.length > 0}
    <div class="search-results">
      {#each results as user}
        <button class="search-result" onclick={() => onResultClick(user.username)}>
          {user.username}
        </button>
      {/each}
    </div>
  {/if}
</div>
