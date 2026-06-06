<script>
  import { t } from '$lib/i18n/i18n.svelte.js';

  let {
    playersOnline = 0,
    gamesInPlay = 0,
    onCreateGame,
    onChallengeFriend,
    onPlayLocally
  } = $props();
</script>

<div class="lobby__start">
  <button
    class="button button-metal lobby__start__button lobby__start__button--hook"
    onclick={() => onCreateGame?.()}
  >
    {t('Create a game')}
  </button>
  <button
    class="button button-metal lobby__start__button lobby__start__button--friend"
    onclick={() => onChallengeFriend?.()}
  >
    {t('Challenge a friend')}
  </button>
  <button
    class="button button-metal lobby__start__button lobby__start__button--ai"
    onclick={() => onPlayLocally?.()}
  >
    {t('Play against computer')}
  </button>

  <div class="lobby__counters">
    <a class="lobby__counter" href="/player">
      <strong>{playersOnline}</strong> players online
    </a>
    <a class="lobby__counter" href="/player">
      <strong>{gamesInPlay}</strong> live rooms
    </a>
  </div>
</div>
