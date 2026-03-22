<script>
  let { color, name, captures = 0, position = 'top', active = false, online = null } = $props();
</script>

<div class="ruser ruser-{position} color-icon is {color}" class:active>
  {#if online === true}
    <i data-testid="presence-{color}" class="presence online"></i>
  {:else if online === false}
    <i data-testid="presence-{color}" class="presence offline"></i>
  {/if}
  <name>{name}</name>
  {#if captures > 0}
    <span class="material">+{captures}</span>
  {/if}
</div>
