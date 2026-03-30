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
  <div class="dasher" class:shown={open}>
    <button id="user_tag" class="link" onclick={toggle}>{username}</button>
    <div class="dropdown">
      {#if pane === 'background'}
        <BackgroundPane onBack={() => (pane = 'main')} />
      {:else if pane === 'board'}
        <BoardPane onBack={() => (pane = 'main')} />
      {:else}
        <a class="text profile-link" href="/profile/{username}">
          <span class="online-dot"></span>
          Profile
        </a>
        <a class="text" data-icon="&#xe005;" href="/account/profile">Preferences</a>
        <button class="text signout" data-icon="&#xe055;" onclick={signOut}>Sign out</button>
        <hr />
        <button class="text" data-icon="&#xe028;" onclick={() => (pane = 'board')}>Board</button>
        <button class="text" data-icon="&#xe061;" onclick={() => (pane = 'background')}
          >Background</button
        >
        <hr />
        <PingStatus />
      {/if}
    </div>
  </div>
{:else}
  <div class="signin-or-signup">
    <a href="/signup" class="button button-metal signup">Register</a>
    <a href="/login" class="button button-metal">Sign in</a>
  </div>
  <div class="dasher" class:shown={open}>
    <button
      class="toggle link anon"
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
        <button class="text" data-icon="&#xe028;" onclick={() => (pane = 'board')}>Board</button>
        <button class="text" data-icon="&#xe061;" onclick={() => (pane = 'background')}
          >Background</button
        >
      {/if}
      <PingStatus />
    </div>
  </div>
{/if}
