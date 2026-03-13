<script>
	import { goto } from '$app/navigation';

	let { gameType, onClose } = $props();

	let dialog = $state(null);
	let timeMode = $state('byoyomi');
	let boardSize = $state(19);
	let color = $state('random');
	let loading = $state(false);

	// Byo-yomi sliders
	let byoMin = $state(10);
	let byoPeriods = $state(3);
	let byoSec = $state(20);

	// Fischer sliders
	let fischerMin = $state(10);
	let fischerInc = $state(0);

	// Correspondence preset
	let corrDays = $state(3);

	$effect(() => {
		dialog?.showModal();
	});

	const BYOYOMI_PRESETS = [
		{ label: '1+3×20s', min: 1, periods: 3, sec: 20 },
		{ label: '3+3×20s', min: 3, periods: 3, sec: 20 },
		{ label: '5+3×20s', min: 5, periods: 3, sec: 20 },
		{ label: '10+3×20s', min: 10, periods: 3, sec: 20 },
		{ label: '20+3×30s', min: 20, periods: 3, sec: 30 },
		{ label: '30+5×30s', min: 30, periods: 5, sec: 30 },
		{ label: '60+5×60s', min: 60, periods: 5, sec: 60 }
	];

	const FISCHER_PRESETS = [
		{ label: '5+0', min: 5, inc: 0 },
		{ label: '10+0', min: 10, inc: 0 },
		{ label: '15+10', min: 15, inc: 10 },
		{ label: '30+0', min: 30, inc: 0 },
		{ label: '40+0', min: 40, inc: 0 }
	];

	const CORR_PRESETS = [1, 3, 7, 14];
	const SIZE_OPTIONS = [9, 13, 19];

	const BUTTON_LABELS = {
		hook: 'Create a game',
		friend: 'Challenge a friend',
		local: 'Play locally'
	};

	function switchTimeMode(mode) {
		timeMode = mode;
		if (mode === 'byoyomi') {
			byoMin = 10;
			byoPeriods = 3;
			byoSec = 20;
		} else if (mode === 'realtime') {
			fischerMin = 10;
			fischerInc = 0;
		} else if (mode === 'correspondence') {
			corrDays = 3;
		}
	}

	function buildTimeControl() {
		if (timeMode === 'unlimited') return { type: 'none' };
		if (timeMode === 'correspondence') return { type: 'correspondence', days: corrDays };
		if (timeMode === 'byoyomi')
			return { type: 'byoyomi', initial: byoMin * 60, periods: byoPeriods, periodTime: byoSec };
		return { type: 'fischer', initial: fischerMin * 60, increment: fischerInc };
	}

	async function submit() {
		loading = true;
		try {
			const timeControl = buildTimeControl();
			const isLocal = gameType === 'local';
			const res = await fetch('/api/game', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					size: boardSize,
					timeControl,
					color: isLocal ? 'black' : color,
					local: isLocal
				})
			});
			const { gameId } = await res.json();
			goto(isLocal ? `/play/${gameId}?local=true` : `/play/${gameId}`);
		} catch {
			loading = false;
		}
	}

	function close() {
		dialog?.close();
		onClose();
	}

	function onDialogClick(e) {
		if (e.target === e.currentTarget) close();
	}

	function corrLabel(days) {
		return days === 1 ? '1 day' : `${days} days`;
	}
</script>

<dialog bind:this={dialog} class="game-setup" onclose={onClose} onclick={onDialogClick}>
	<div class="scrollable">
		<div class="close-button-anchor">
			<button class="close-button" data-icon="" onclick={close} aria-label="Close"></button>
		</div>

		<h2>Game Setup</h2>

		<div class="setup-content">
			<!-- Board size -->
			<div class="config-group">
				<div class="label">Board size</div>
				<div class="size-choices">
					{#each SIZE_OPTIONS as size}
						<button
							class="size-choice"
							class:active={boardSize === size}
							onclick={() => (boardSize = size)}
						>
							{size}×{size}
						</button>
					{/each}
				</div>
			</div>

			<!-- Time control -->
			<div class="config-group time-control-tabs">
				<div class="tabs-horiz">
					<button class:active={timeMode === 'byoyomi'} onclick={() => switchTimeMode('byoyomi')}>
						Byo-yomi
					</button>
					<button class:active={timeMode === 'realtime'} onclick={() => switchTimeMode('realtime')}>
						Fischer
					</button>
					<button
						class:active={timeMode === 'correspondence'}
						onclick={() => switchTimeMode('correspondence')}
					>
						Correspondence
					</button>
					<button
						class:active={timeMode === 'unlimited'}
						onclick={() => switchTimeMode('unlimited')}
					>
						Unlimited
					</button>
				</div>

				{#if timeMode === 'byoyomi'}
					<div class="time-panel">
						<div class="sliders">
							<div class="slider-row">
								<span class="slider-label">Minutes per side</span>
								<input
									class="range"
									type="range"
									min="0"
									max="60"
									value={byoMin}
									oninput={(e) => (byoMin = +e.target.value)}
								/>
								<span class="val-box">{byoMin}</span>
							</div>
							<div class="slider-row">
								<span class="slider-label">Byo-yomi periods</span>
								<input
									class="range"
									type="range"
									min="1"
									max="10"
									value={byoPeriods}
									oninput={(e) => (byoPeriods = +e.target.value)}
								/>
								<span class="val-box">{byoPeriods}</span>
							</div>
							<div class="slider-row">
								<span class="slider-label">Period time (seconds)</span>
								<input
									class="range"
									type="range"
									min="5"
									max="120"
									step="5"
									value={byoSec}
									oninput={(e) => (byoSec = +e.target.value)}
								/>
								<span class="val-box">{byoSec}s</span>
							</div>
						</div>
						<div class="presets">
							{#each BYOYOMI_PRESETS as p}
								<button
									class="preset-btn"
									class:active={byoMin === p.min && byoPeriods === p.periods && byoSec === p.sec}
									onclick={() => {
										byoMin = p.min;
										byoPeriods = p.periods;
										byoSec = p.sec;
									}}
								>
									{p.label}
								</button>
							{/each}
						</div>
					</div>
				{:else if timeMode === 'realtime'}
					<div class="time-panel">
						<div class="sliders-grid">
							<div class="slider-container">
								<div class="label-row">
									<label>Minutes per side</label>
									<span class="val-box">{fischerMin}</span>
								</div>
								<input
									class="range"
									type="range"
									min="1"
									max="60"
									value={fischerMin}
									oninput={(e) => (fischerMin = +e.target.value)}
								/>
							</div>
							<div class="slider-separator">+</div>
							<div class="slider-container">
								<div class="label-row">
									<span class="val-box">{fischerInc}s</span>
									<label>Increment (seconds)</label>
								</div>
								<input
									class="range"
									type="range"
									min="0"
									max="60"
									value={fischerInc}
									oninput={(e) => (fischerInc = +e.target.value)}
								/>
							</div>
						</div>
						<div class="presets">
							{#each FISCHER_PRESETS as p}
								<button
									class="preset-btn"
									class:active={fischerMin === p.min && fischerInc === p.inc}
									onclick={() => {
										fischerMin = p.min;
										fischerInc = p.inc;
									}}
								>
									{p.label}
								</button>
							{/each}
						</div>
					</div>
				{:else if timeMode === 'correspondence'}
					<div class="time-panel">
						<div class="slider-container">
							<div class="label-row">
								<label>Days per turn</label>
								<span class="val-box">{corrLabel(corrDays)}</span>
							</div>
							<input
								class="range"
								type="range"
								min="1"
								max="14"
								value={corrDays}
								oninput={(e) => (corrDays = +e.target.value)}
							/>
						</div>
						<div class="presets">
							{#each CORR_PRESETS as days}
								<button
									class="preset-btn"
									class:active={corrDays === days}
									onclick={() => (corrDays = days)}
								>
									{corrLabel(days)}
								</button>
							{/each}
						</div>
					</div>
				{:else}
					<div class="time-panel">
						<p class="unlimited-label">No time limit</p>
					</div>
				{/if}
			</div>

			<!-- Color picker -->
			<div class="config-group">
				<div class="label">Side</div>
				<div class="color-choices">
					{#each [['black', 'Black'], ['random', 'Random'], ['white', 'White']] as [key, name]}
						<button class="color-choice" class:active={color === key} onclick={() => (color = key)}>
							<div class="color-picker__button {key}"><i></i></div>
							<span class="text">{name}</span>
						</button>
					{/each}
				</div>
			</div>
		</div>

		<div class="footer">
			<button
				class="button button-metal lobby__start__button lobby__start__button--{gameType}"
				onclick={submit}
				disabled={loading}
				class:disabled={loading}
			>
				{BUTTON_LABELS[gameType]}
			</button>
			{#if loading}
				<div class="spinner"></div>
			{/if}
		</div>
	</div>
</dialog>
