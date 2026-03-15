<script>
	import { scoreVerdict } from '$lib/gameUtils.js';

	let { score, komi = 6.5, blackApproved = false, whiteApproved = false, showApprovals = false } = $props();
</script>

{#if score}
	<div class="score-breakdown">
		<div class="score-row">
			<span class="color-icon is black text">Black</span>
			<span>{score.blackArea}</span>
		</div>
		<div class="score-row">
			<span class="color-icon is white text">White</span>
			<span>{score.whiteArea} + {komi} = {score.whiteScore.toFixed(1)}</span>
		</div>
		<div class="score-verdict">
			{scoreVerdict(score)}
		</div>
	</div>
{/if}

{#if showApprovals}
	<div class="score-approvals">
		<span class="approval" class:approved={blackApproved}
			>Black {blackApproved ? '✓' : '…'}</span
		>
		<span class="approval" class:approved={whiteApproved}
			>White {whiteApproved ? '✓' : '…'}</span
		>
	</div>
{/if}

<style>
	.score-approvals {
		display: flex;
		gap: 1em;
		padding: 0.5em 1em;
		justify-content: center;
	}

	.approval {
		color: var(--c-font-dim);
		font-size: 0.9em;
	}

	.approval.approved {
		color: var(--c-good);
		font-weight: bold;
	}
</style>
