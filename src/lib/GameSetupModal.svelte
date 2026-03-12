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

	const REALTIME_PRESETS = ['5+0', '5+3', '10+0', '15+0', '30+0', '60+0', '90+30'];
	const CORR_PRESETS = ['1 day', '3 days', '7 days', '14 days'];
	const SIZE_OPTIONS = [9, 13, 19];

	const BUTTON_LABELS = {
		hook: 'Create a game',
		friend: 'Challenge a friend',
		local: 'Play locally'
	};

	function switchTimeMode(mode) {
		timeMode = mode;
		selectedClock = mode === 'realtime' ? '10+0' : mode === 'correspondence' ? '3 days' : null;
	}

	async function submit() {
		if (gameType === 'local') {
			goto(`/play/local?size=${boardSize}`);
			return;
		}
		loading = true;
		try {
			const res = await fetch('/api/game', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ size: boardSize })
			});
			const { gameId } = await res.json();
			goto(`/play/${gameId}`);
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

			<!-- Time control (not shown for local play) -->
			{#if gameType !== 'local'}
				<div class="config-group time-control-tabs">
					<div class="tabs-horiz">
						<button
							class:active={timeMode === 'realtime'}
							onclick={() => switchTimeMode('realtime')}
						>
							Realtime
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
					{#each [['white', 'White'], ['black', 'Black'], ['random', 'Random']] as [key, name]}
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
