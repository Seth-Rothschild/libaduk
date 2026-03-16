<script>
	let {
		clockData,
		running,
		position = 'bottom',
		initialMs = null,
		turnStartedAt = null,
		onTimeout = null
	} = $props();

	let displayMs = $state(0);
	let clientInByo = $state(false);
	let clientByoPeriods = $state(0);

	function compute(clockData, running, turnStartedAt) {
		if (!clockData) return { ms: 0, inByo: false, periods: 0 };
		const elapsed = running && turnStartedAt ? Math.max(0, Date.now() - turnStartedAt) : 0;

		if (clockData.inByoYomi) {
			return computeByo(clockData.byoMs, clockData.byoPeriods, clockData.periodMs ?? 0, elapsed);
		}

		const mainRemaining = clockData.mainMs - elapsed;
		if (mainRemaining <= 0 && clockData.byoPeriods > 0) {
			const overflow = -mainRemaining;
			const byoStartMs = clockData.byoMs;
			return computeByo(
				byoStartMs,
				clockData.byoPeriods,
				clockData.periodMs ?? byoStartMs,
				overflow
			);
		}
		return { ms: Math.max(0, mainRemaining), inByo: false, periods: 0 };
	}

	function computeByo(byoMs, periods, periodMs, elapsed) {
		let remaining = byoMs - elapsed;
		let periodsLeft = periods;
		const step = periodMs > 0 ? periodMs : byoMs;
		while (remaining <= 0 && periodsLeft > 1) {
			periodsLeft--;
			remaining += step;
		}
		if (remaining <= 0) return { ms: 0, inByo: true, periods: 0 };
		return { ms: remaining, inByo: true, periods: periodsLeft };
	}

	$effect(() => {
		if (!clockData) {
			displayMs = 0;
			clientInByo = false;
			clientByoPeriods = 0;
			return;
		}
		const { ms, inByo, periods } = compute(clockData, running, turnStartedAt);
		displayMs = ms;
		clientInByo = inByo;
		clientByoPeriods = periods;
	});

	$effect(() => {
		if (!running || !clockData) return;
		const interval = setInterval(() => {
			const prev = displayMs;
			const { ms, inByo, periods } = compute(clockData, running, turnStartedAt);
			displayMs = ms;
			clientInByo = inByo;
			clientByoPeriods = periods;
			if (ms === 0 && prev > 0) onTimeout?.();
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
	const byoPeriodSecs = $derived(
		clockData?.periodMs
			? Math.ceil(clockData.periodMs / 1000)
			: Math.ceil((clockData?.byoMs ?? 0) / 1000)
	);
	const byoLabel = $derived(
		clientInByo && clientByoPeriods > 0 ? `${clientByoPeriods}×${byoPeriodSecs}s` : null
	);
</script>

{#if clockData}
	<div
		class="rclock rclock-{position}"
		class:running
		class:emerg={isEmerg}
		class:outoftime={isOut}
		aria-label="Clock"
		role="timer"
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
