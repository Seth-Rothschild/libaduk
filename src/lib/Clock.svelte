<script>
	let { clockData, running, position = 'bottom', initialMs = null, turnStartedAt = null } = $props();

	let displayMs = $state(0);

	// Sync from server — offset by however long this turn has already been running
	$effect(() => {
		if (!clockData) { displayMs = 0; return; }
		const base = clockData.inByoYomi ? clockData.byoMs : clockData.mainMs;
		const elapsed = (running && turnStartedAt) ? Math.max(0, Date.now() - turnStartedAt) : 0;
		displayMs = Math.max(0, base - elapsed);
	});

	// Countdown interval — runs only when it's this player's turn
	$effect(() => {
		if (!running || !clockData) return;
		const base = clockData.inByoYomi ? clockData.byoMs : clockData.mainMs;
		const elapsed0 = turnStartedAt ? Math.max(0, Date.now() - turnStartedAt) : 0;
		const startVal = Math.max(0, base - elapsed0);
		const tickStart = Date.now();
		const interval = setInterval(() => {
			displayMs = Math.max(0, startVal - (Date.now() - tickStart));
		}, 100);
		return () => clearInterval(interval);
	});

	function formatTime(ms) {
		if (ms <= 0) return '0:00';
		const totalSeconds = Math.floor(ms / 1000);
		const hours = Math.floor(totalSeconds / 3600);
		const minutes = Math.floor((totalSeconds % 3600) / 60);
		const seconds = totalSeconds % 60;
		if (hours > 0) {
			return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
		}
		return `${minutes}:${String(seconds).padStart(2, '0')}`;
	}

	const isHour = $derived(displayMs >= 3600000);
	const isEmerg = $derived(displayMs > 0 && displayMs < 30000);
	const isOut = $derived(clockData != null && displayMs <= 0);
	const barScale = $derived(
		initialMs && initialMs > 0 ? Math.max(0, Math.min(1, displayMs / initialMs)) : 1
	);
	const byoLabel = $derived(
		clockData?.inByoYomi && clockData.byoPeriods > 0
			? `${clockData.byoPeriods}×${Math.ceil((clockData.byoMs ?? 0) / 1000)}s`
			: null
	);
</script>

{#if clockData}
	<div
		class="rclock rclock-{position}"
		class:running
		class:emerg={isEmerg}
		class:outoftime={isOut}
	>
		<div class="time" class:hour={isHour}>
			{formatTime(displayMs)}
			{#if byoLabel}
				<span class="byo-label">{byoLabel}</span>
			{/if}
		</div>
		{#if initialMs}
			<div class="bar" style="transform: scaleX({barScale})"></div>
		{/if}
	</div>
{/if}

<style>
	.byo-label {
		font-size: 0.45em;
		align-self: flex-end;
		margin-bottom: 0.2em;
		margin-left: 0.4em;
		opacity: 0.75;
		letter-spacing: 0;
	}
</style>
