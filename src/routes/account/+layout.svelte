<script>
  import { page } from '$app/stores';

  let { children } = $props();

  const path = $derived($page.url.pathname);

  const navLinks = [
    { href: '/account/profile', label: 'Edit Profile' },
    { sep: true },
    { href: '/account/preferences/ai', label: 'Computer AI' },
    { href: '/account/preferences/ogs', label: 'Link OGS' },
    { sep: true },
    { href: '/account/security', label: 'Security' }
  ];
</script>

<div class="account page-menu">
  <nav class="page-menu__menu">
    <div class="side">
      {#each navLinks as link}
        {#if link.sep}
          <div class="sep"></div>
        {:else}
          <a
            class="text"
            class:active={path === link.href || path.startsWith(link.href + '/')}
            href={link.href}>{link.label}</a
          >
        {/if}
      {/each}
    </div>
  </nav>

  <div class="page-menu__content box box-pad">
    {@render children()}
  </div>
</div>
