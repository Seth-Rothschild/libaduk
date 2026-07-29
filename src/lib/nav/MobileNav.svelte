<script>
  import { t } from '$lib/i18n/i18n.svelte.js';

  let { open, onClose } = $props();
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && open && onClose()} />

{#if open}
  <button class="mobile-nav-overlay" onclick={onClose} tabindex="-1" aria-label="Close navigation"
  ></button>
{/if}

<nav class="mobile-nav" class:open inert={!open} aria-label="Mobile">
  <section>
    <a href="/" onclick={onClose}>{t('Play')}</a>
    <div role="group">
      <a href="/?setup=hook" onclick={onClose}>{t('Create a game')}</a>
      <a href="/?setup=friend" onclick={onClose}>{t('Challenge a friend')}</a>
      <a href="/?setup=ai" onclick={onClose}>{t('Play against computer')}</a>
    </div>
  </section>
  <section>
    <a href="/learn" onclick={onClose}>{t('Learn')}</a>
    <div role="group">
      <a href="/learn" onclick={onClose}>{t('Lessons')}</a>
      <a href="/library" onclick={onClose}>{t('Library')}</a>
    </div>
  </section>
  <section>
    <a href="/puzzle" onclick={onClose}>{t('Puzzles')}</a>
    <div role="group">
      <a href="/puzzle" onclick={onClose}>{t('Random puzzle')}</a>
      <a href="/puzzle/daily" onclick={onClose}>{t('Puzzle of the day')}</a>
    </div>
  </section>
  <section>
    <a href="/tv" onclick={onClose}>{t('Watch')}</a>
    <div role="group">
      <a href="/tv" onclick={onClose}>{t('TV')}</a>
    </div>
  </section>
  <section>
    <a href="/player" onclick={onClose}>{t('Community')}</a>
    <div role="group">
      <a href="/player" onclick={onClose}>{t('Players')}</a>
      <a href="/player/activity" onclick={onClose}>{t('Activity')}</a>
      <a href="https://online-go.com/group/16370" onclick={onClose}>{t('OGS Group')}</a>
      <a href="https://github.com/Seth-Rothschild/libaduk/issues" onclick={onClose}
        >{t('Github Issues')}</a
      >
    </div>
  </section>
  <section>
    <a href="/scratch" onclick={onClose}>{t('Tools')}</a>
    <div role="group">
      <a href="/scratch" onclick={onClose}>{t('Scratch board')}</a>
      <a href="/kifu" onclick={onClose}>{t('Create Kifu')}</a>
      <a href="/import" onclick={onClose}>{t('Import game')}</a>
      <a href="/snapshot-record" onclick={onClose}>{t('Snapshot record')}</a>
    </div>
  </section>
</nav>

<style>
  .mobile-nav-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    z-index: 110;
    border: none;
    padding: 0;
    width: 100%;
    height: 100%;
    cursor: default;
  }

  .mobile-nav {
    position: fixed;
    top: var(---site-header-height);
    left: 0;
    bottom: 0;
    z-index: 111;
    background: var(--c-bg-high);
    width: min(80vw, 300px);
    padding-bottom: 1.2rem;
    overflow-y: auto;
    overscroll-behavior: contain;
    box-shadow: 2px 5px 7px hsla(0, 0%, 0%, 0.5);
    border-radius: 0 3px 0 0;
    display: flex;
    flex-direction: column;
    transform: translateX(calc(-100% - 10px));
    transition: transform 0.22s cubic-bezier(0.55, 0.055, 0.675, 0.19);
  }

  .mobile-nav.open {
    transform: translateX(0);
    transition-timing-function: cubic-bezier(0.215, 0.61, 0.355, 1);
  }

  .mobile-nav section {
    margin-top: 1rem;
  }

  .mobile-nav section > a {
    display: block;
    font-size: 1.2em;
    padding: 0.7em 1.2rem;
    font-weight: bold;
    color: var(--c-font);
    text-decoration: none;
  }

  .mobile-nav section div {
    display: flex;
    flex-direction: column;
  }

  .mobile-nav section div a,
  .mobile-nav section div button {
    display: block;
    padding: 0.7em 2.4rem;
    color: var(--c-font);
    text-align: start;
    background: none;
    border: none;
    font: inherit;
    cursor: pointer;
    text-decoration: none;
  }

  .mobile-nav section a:active,
  .mobile-nav section button:active {
    background: var(--c-primary);
    color: var(--c-over);
  }

  @media (hover: hover) and (pointer: fine) {
    .mobile-nav section a:hover,
    .mobile-nav section button:hover {
      background: var(--c-primary);
      color: var(--c-over);
    }
  }
</style>
