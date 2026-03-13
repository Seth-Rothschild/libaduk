<script>
	import { goto } from '$app/navigation';

	let { gameType, onClose } = $props();

	let dialog = $state(null);
	let timeMode = $state('realtime');
	let selectedClock = $state('10+0');
	let boardSize = $state(19);
	let color = $state('random');
	let loading = $state(false);

	$effect(() => {
		dialog?.showModal();
	});

	const REALTIME_PRESETS = ['1+0', '2+1', '3+0', '5+0', '5+3', '10+0', '15+0', '30+0'];
	const BYOYOMI_PRESETS = ['0+3×10s', '1+3×10s', '3+3×20s', '10+5×30s', '20+5×30s', '60+5×60s'];
	const CORR_PRESETS = ['1 day', '3 days', '7 days', '14 days'];

	function parseTimeControl(mode, clockStr) {
		if (mode === 'unlimited') return { type: 'none' };
		if (mode === 'correspondence') {
			const days = parseInt(clockStr);
			return { type: 'correspondence', days };
		}
		if (mode === 'byoyomi') {
			// Format: "10+5×30s" → initial=10min, periods=5, periodTime=30s
			const match = clockStr.match(/^(\d+)\+(\d+)×(\d+)s$/);
			if (match) {
				return {
					type: 'byoyomi',
					initial: parseInt(match[1]) * 60,
					periods: parseInt(match[2]),
					periodTime: parseInt(match[3])
				};
			}
		}
		// Fischer: "10+0" or "5+3"
		const parts = clockStr.split('+');
		return {
			type: 'fischer',
			initial: parseInt(parts[0]) * 60,
			increment: parseInt(parts[1] ?? '0')
		};
	}
	const SIZE_OPTIONS = [9, 13, 19];

	const BUTTON_LABELS = {
		hook: 'Create a game',
		friend: 'Challenge a friend',
		local: 'Play locally'
	};

	function switchTimeMode(mode) {
		timeMode = mode;
		if (mode === 'realtime') selectedClock = '10+0';
		else if (mode === 'byoyomi') selectedClock = '10+5×30s';
		else if (mode === 'correspondence') selectedClock = '3 days';
		else selectedClock = null;
	}

	async function submit() {
		loading = true;
		try {
			const timeControl = parseTimeControl(timeMode, selectedClock);
			const isLocal = gameType === 'local';
			const res = await fetch('/api/game', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ size: boardSize, timeControl, color: isLocal ? 'black' : color, local: isLocal })
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
			{#if true}
				<div class="config-group time-control-tabs">
					<div class="tabs-horiz">
						<button
							class:active={timeMode === 'realtime'}
							onclick={() => switchTimeMode('realtime')}
						>
							Fischer
						</button>
						<button
							class:active={timeMode === 'byoyomi'}
							onclick={() => switchTimeMode('byoyomi')}
						>
							Byo-yomi
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

					{#if timeMode === 'realtime'}
						<div class="time-panel">
							<div class="presets">
								{#each REALTIME_PRESETS as preset}
									<button
										class="preset-btn"
										class:active={selectedClock === preset}
										onclick={() => (selectedClock = preset)}
									>
										{preset}
									</button>
								{/each}
							</div>
						</div>
					{:else if timeMode === 'byoyomi'}
						<div class="time-panel">
							<div class="presets">
								{#each BYOYOMI_PRESETS as preset}
									<button
										class="preset-btn"
										class:active={selectedClock === preset}
										onclick={() => (selectedClock = preset)}
									>
										{preset}
									</button>
								{/each}
							</div>
						</div>
					{:else if timeMode === 'correspondence'}
						<div class="time-panel">
							<div class="presets">
								{#each CORR_PRESETS as preset}
									<button
										class="preset-btn"
										class:active={selectedClock === preset}
										onclick={() => (selectedClock = preset)}
									>
										{preset}
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
			{/if}

			<!-- Color picker -->
			<div class="config-group">
				<div class="label">Side</div>
				<div class="color-choices">
					{#each [['black', 'Black'],  ['random', 'Random'], ['white', 'White']] as [key, name]}
						<button
							class="color-choice"
							class:active={color === key}
							onclick={() => (color = key)}
						>
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
