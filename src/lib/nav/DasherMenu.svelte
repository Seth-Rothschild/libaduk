<script>
  import PingStatus from './PingStatus.svelte';
  import BackgroundPane from './BackgroundPane.svelte';
  import BoardPane from './BoardPane.svelte';

  let { username, onSignOut } = $props();

  const signedIn = $derived(username.length > 0);

  let open = $state(false);
  let pane = $state('main');

  const close = () => {
    open = false;
    pane = 'main';
  };
  const toggle = () => (open ? close() : (open = true));

  const signOut = () => {
    onSignOut();
    close();
  };
</script>

{#if signedIn}
  <a id="user_tag" href="/profile/{username}" class="link">{username}</a>
{:else}
  <div class="signin-or-signup">
    <a href="/signup" class="button button-metal signup">Register</a>
    <a href="/login" class="button button-metal">Sign in</a>
  </div>
{/if}

<div class="dasher" class:shown={open}>
  <button
    class="toggle link"
    class:anon={!signedIn}
    data-icon="&#xe005;"
    aria-label="Settings"
    title="Settings"
    onclick={toggle}
  ></button>
  <div class="dropdown">
    {#if pane === 'background'}
      <BackgroundPane onBack={() => (pane = 'main')} />
    {:else if pane === 'board'}
      <BoardPane onBack={() => (pane = 'main')} />
    {:else}
      {#if signedIn}
        <a class="text" data-icon="&#xe005;" href="/">Settings</a>
      {/if}
      <button class="text" data-icon="&#xe028;" onclick={() => (pane = 'board')}>Board</button>
      <button class="text" data-icon="&#xe061;" onclick={() => (pane = 'background')}
        >Background</button
      >
      {#if signedIn}
        <button class="text signout" data-icon="&#xe055;" onclick={signOut}>Sign out</button>
      {/if}
    {/if}
    <PingStatus />
  </div>
</div>
