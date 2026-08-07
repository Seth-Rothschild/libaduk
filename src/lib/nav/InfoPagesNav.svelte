<script>
  import { page } from '$app/stores';

  const path = $derived($page.url.pathname);

  const navLinks = [
    { href: '/about', label: 'About' },
    { href: '/faq', label: 'FAQ' },
    { href: '/updates', label: 'Updates' }
  ];
</script>

<nav class="page-menu__menu">
  <div class="side">
    {#each navLinks as link}
      <a class="text" class:active={path === link.href} href={link.href}>{link.label}</a>
    {/each}
  </div>
</nav>

<style>
  .side {
    display: flex;
    flex-direction: column;
    min-width: 160px;
    margin-right: 10px;
  }

  .side a.text {
    display: block;
    padding: 0.7rem 2vw 0.7rem 0.8rem;
    border-radius: 6px;
    color: var(--c-font-page);
    text-decoration: none;
    white-space: nowrap;
    transition: background 150ms ease;
  }

  .side a.text:hover {
    background: var(--m-bg-page_bg--mix-50);
  }

  .side a.text.active {
    background: var(--c-bg-box);
    color: var(--c-font);
    font-weight: bold;
  }
</style>
