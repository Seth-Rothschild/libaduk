<script>
  import { t } from '$lib/i18n/i18n.svelte.js';
</script>

<nav id="topnav" class="hover" aria-label="Main">
  <section>
    <a href="/">
      <span class="play">{t('Play')}</span>
      <span class="home">libaduk.com</span>
    </a>
    <div role="group">
      <a href="/?setup=hook">{t('Create a game')}</a>
      <a href="/?setup=friend">{t('Challenge a friend')}</a>
      <a href="/?setup=ai">{t('Play against computer')}</a>
    </div>
  </section>
  <section>
    <a href="/learn">{t('Learn')}</a>
    <div role="group">
      <a href="/learn">{t('Lessons')}</a>
      <a href="/library">{t('Library')}</a>
    </div>
  </section>
  <section>
    <a href="/puzzle">{t('Puzzles')}</a>
    <div role="group">
      <a href="/puzzle">{t('Random puzzle')}</a>
      <a href="/puzzle/daily">{t('Puzzle of the day')}</a>
    </div>
  </section>
  <section>
    <a href="/tv">{t('Watch')}</a>
    <div role="group">
      <a href="/tv">{t('TV')}</a>
    </div>
  </section>
  <section>
    <a href="/player">{t('Community')}</a>
    <div role="group">
      <a href="/player">{t('Players')}</a>
      <a href="/player/activity">{t('Activity')}</a>
      <a href="https://online-go.com/group/16370">{t('OGS Group')}</a>
      <a href="https://github.com/Seth-Rothschild/libaduk/issues">{t('Github Issues')}</a>
    </div>
  </section>
  <section>
    <a href="/scratch" data-sveltekit-preload-data="off">{t('Tools')}</a>
    <div role="group">
      <a href="/scratch" data-sveltekit-preload-data="off">{t('Scratch board')}</a>
      <a href="/kifu" data-sveltekit-preload-data="off">{t('Create Kifu')}</a>
      <a href="/import">{t('Import game')}</a>
      <a href="/snapshot-record" data-sveltekit-preload-data="off">{t('Snapshot record')}</a>
    </div>
  </section>
</nav>
