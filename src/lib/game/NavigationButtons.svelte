<script>
  let {
    canPrev = false,
    canNext = false,
    onFirst,
    onPrev,
    onNext,
    onLast,
    menuItems = []
  } = $props();
  let showMenu = $state(false);
</script>

<div class="rbuttons">
  <button
    class="fbt"
    data-icon="&#xe035;"
    disabled={!canPrev}
    onclick={onFirst}
    aria-label="First move"
  ></button>
  <button
    class="fbt"
    data-icon="&#xe037;"
    disabled={!canPrev}
    onclick={onPrev}
    aria-label="Previous move"
  ></button>
  <button
    class="fbt"
    data-icon="&#xe036;"
    disabled={!canNext}
    onclick={onNext}
    aria-label="Next move"
  ></button>
  <button
    class="fbt"
    data-icon="&#xe034;"
    disabled={!canNext}
    onclick={onLast}
    aria-label="Last move"
  ></button>
  {#if menuItems.length > 0}
    <div class="rbuttons-menu-wrap">
      <button
        class="fbt rbuttons-menu-btn"
        class:open={showMenu}
        onclick={() => (showMenu = !showMenu)}
        aria-label="More options"
      ></button>
      {#if showMenu}
        <div class="rbuttons-menu">
          {#each menuItems as item}
            {#if item.href}
              <a class="rbuttons-menu-item" href={item.href} onclick={() => (showMenu = false)}
                >{item.label}</a
              >
            {:else}
              <button
                class="rbuttons-menu-item"
                onclick={() => {
                  item.onclick();
                  showMenu = false;
                }}>{item.label}</button
              >
            {/if}
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</div>
