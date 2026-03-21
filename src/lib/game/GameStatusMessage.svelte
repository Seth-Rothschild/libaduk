<script>
  import ScoreBreakdown from './ScoreBreakdown.svelte';
  import { formatCorrDeadline } from '$lib/gameUtils.js';

  const ICON_INFO = '\ue060';

  let {
    status,
    isLocal,
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
      {#if isLocal}
        <strong>{currentSign === 1 ? 'Black' : 'White'}</strong> to move<br />
      {:else if isSpectator}
        Waiting for players...
      {:else}
        You are <strong>{myColor}</strong><br />
        Share this link to invite a friend.
      {/if}
    </div>
  </div>
{:else if status === 'playing'}
  <div class="message" data-icon={ICON_INFO}>
    <div>
      {#if isLocal}
        <strong>{currentSign === 1 ? 'Black' : 'White'}</strong>'s turn
      {:else if isSpectator}
        Spectating<br />{currentSign === 1 ? 'Black' : 'White'} to play
      {:else if isMyTurn}
        You play the {myColor} stones<br /><strong>It's your turn!</strong>
      {:else}
        Waiting for opponent...
      {/if}
      {#if isCorrGame && corrDeadline}
        <br /><span class="corr-deadline">{formatCorrDeadline(corrDeadline)}</span>
      {/if}
    </div>
  </div>
{:else if status === 'scoring'}
  <div class="message" data-icon={ICON_INFO}>
    <div>
      Counting territory<br />
      <strong>Click stones to mark dead</strong>
    </div>
  </div>
  <ScoreBreakdown {score} {komi} {blackApproved} {whiteApproved} showApprovals={true} />
{:else if status === 'gameover'}
  <div class="message" data-icon={ICON_INFO}>
    <div>
      {#if isLocal || isSpectator}
        {winner === 1 ? 'Black' : 'White'} wins
      {:else}
        {winner === mySign ? 'You win' : 'You lose'}
      {/if}
      {#if winnerResult}
        <br />{winnerResult}
      {:else if finalScore}
        <br />{finalScore.blackScore.toFixed(1)} &ndash; {finalScore.whiteScore.toFixed(1)}
      {:else}
        <br />by resignation
      {/if}
    </div>
  </div>
{:else if status === 'abandoned'}
  <div class="message" data-icon={ICON_INFO}>
    <div>
      {isSpectator ? 'A player has left the game.' : 'Your opponent has left the game.'}
    </div>
  </div>
{:else if status === 'aborted'}
  <div class="message" data-icon={ICON_INFO}>
    <div>This game was aborted.</div>
  </div>
{/if}
