<script>
  import ScoreBreakdown from './ScoreBreakdown.svelte';
  import { t } from '$lib/i18n/i18n.svelte.js';
  const ICON_INFO = '';

  function formatCorrDeadline(deadline) {
    if (!deadline) return '';
    const remaining = deadline - Date.now();
    if (remaining <= 0) return 'Overdue';
    const days = Math.floor(remaining / 86400000);
    const hours = Math.floor((remaining % 86400000) / 3600000);
    if (days > 0) return `${days}d ${hours}h remaining`;
    const minutes = Math.floor((remaining % 3600000) / 60000);
    if (hours > 0) return `${hours}h ${minutes}m remaining`;
    return `${minutes}m remaining`;
  }

  function resultLabel(result) {
    if (!result) return null;
    if (result.endsWith('+R')) return t('by Resignation');
    if (result.endsWith('+T')) return t('by Time');
    return result;
  }

  let {
    status,
    isSpectator,
    isMyTurn,
    myColor,
    mySign,
    currentSign,
    isCorrGame,
    corrDeadline,
    score,
    komi,
    blackApproved,
    whiteApproved,
    winner,
    winnerResult,
    finalScore
  } = $props();
</script>

{#if status === 'waiting'}
  <div class="message" data-icon={ICON_INFO}>
    <div>
      {#if isSpectator}
        {t('Waiting for players...')}
      {:else}
        {t(myColor === 'black' ? 'You play Black' : 'You play White')}<br />
        {t('Share this link to invite a friend.')}
      {/if}
    </div>
  </div>
{:else if status === 'playing'}
  <div class="message" data-icon={ICON_INFO}>
    <div>
      {#if isSpectator}
        {t('Spectating')}<br />{t(currentSign === 1 ? 'Black to play' : 'White to play')}
      {:else if isMyTurn}
        {t(myColor === 'black' ? 'You play Black' : 'You play White')}<br /><strong
          >{t("It's your turn!")}</strong
        >
      {:else}
        {t("It's your opponent's turn")}
      {/if}
      {#if isCorrGame && corrDeadline}
        <br /><span class="corr-deadline">{formatCorrDeadline(corrDeadline)}</span>
      {/if}
    </div>
  </div>
{:else if status === 'scoring'}
  <div class="message" data-icon={ICON_INFO}>
    <div>
      {t('Counting territory')}<br />
      <strong>{t('Click stones to mark dead')}</strong>
    </div>
  </div>
  <ScoreBreakdown {score} {komi} {blackApproved} {whiteApproved} showApprovals={true} />
{:else if status === 'gameover'}
  <div class="message" data-icon={ICON_INFO}>
    <div>
      {#if isSpectator}
        {t(winner === 1 ? 'Black wins' : 'White wins')}
      {:else}
        {t(winner === mySign ? 'You win' : 'You lose')}
      {/if}
      {#if winnerResult}
        <br />{resultLabel(winnerResult)}
      {:else if finalScore}
        <br />{finalScore.blackScore.toFixed(1)} &ndash; {finalScore.whiteScore.toFixed(1)}
      {:else}
        <br />{t('by resignation')}
      {/if}
    </div>
  </div>
{:else if status === 'abandoned'}
  <div class="message" data-icon={ICON_INFO}>
    <div>
      {t(isSpectator ? 'A player has left the game.' : 'Your opponent has left the game.')}
    </div>
  </div>
{:else if status === 'cancelled'}
  <div class="message" data-icon={ICON_INFO}>
    <div>{t('This game was cancelled.')}</div>
  </div>
{/if}
