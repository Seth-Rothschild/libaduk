<script>
  import InfoPagesNav from '$lib/nav/InfoPagesNav.svelte';
  import { allAnnouncements, renderMarkdown } from '$lib/announcements/announcements.js';
  import { formatTime } from '$lib/format.js';
</script>

<main class="page-menu">
  <InfoPagesNav />
  <div class="page-menu__content box box-pad">
    <h1 class="box__top">Libaduk updates</h1>
    <div class="daily-feed__updates">
      {#each allAnnouncements as update (update.id)}
        <div class="daily-feed__update" id={update.id}>
          <div class="daily-feed__update__marker"></div>
          <div class="daily-feed__update__content">
            <section class="daily-feed__update__day">
              <h2><a href="#{update.id}">{update.title}</a></h2>
              <time>{formatTime(update.date)}</time>
            </section>
            <div class="daily-feed__update__markup announcement-body">
              {#if update.subtitle}
                <p class="daily-feed__update__subtitle">{update.subtitle}</p>
              {/if}
              {@html renderMarkdown(update.body)}
            </div>
          </div>
        </div>
      {/each}
    </div>
  </div>
</main>

<style>
  h1.box__top {
    padding: 0 0 4vh 0;
    font-size: 38px;
  }

  .daily-feed__updates {
    margin: 3em 3em 0 3em;
    border-inline-start: 3px solid var(--c-contours);
  }

  .daily-feed__update {
    padding-inline-start: 45px;
    margin-bottom: 4em;
  }

  .daily-feed__update__marker {
    float: inline-start;
    width: 54px;
    height: 54px;
    margin-top: -14px;
    margin-inline-start: -74px;
    background-color: var(--c-contours);
    border: 3px solid var(--c-bg-box);
    border-radius: 50%;
  }

  .daily-feed__update__day {
    display: flex;
    align-items: baseline;
    gap: 0.75rem;
    margin-bottom: 1rem;
  }

  .daily-feed__update__day h2 {
    display: inline;
    font-size: 1.5em;
  }

  .daily-feed__update__day a {
    font-weight: bold;
    color: var(--c-contours);
    text-decoration: none;
  }

  .daily-feed__update__day time {
    font-size: 1em;
    color: var(--c-font-dimmer);
  }

  .daily-feed__update__subtitle {
    color: var(--c-font-dim);
    font-style: italic;
  }
</style>
