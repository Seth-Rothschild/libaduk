<script>
	import GoBoardLib from '@sabaki/go-board';
	import GoBoard from '$lib/GoBoard.svelte';
	import { page } from '$app/state';

	const VALID_SIZES = [9, 13, 19];
	const rawSize = Number(page.url.searchParams.get('size') ?? 19);
	const SIZE = VALID_SIZES.includes(rawSize) ? rawSize : 19;
	const KOMI = 6.5;

	// licon-InfoCircle (e060)
	const ICON_INFO = '\ue060';

	function emptyShiftMap(size) {
		return Array.from({ length: size }, () => new Array(size).fill(0));
	}

	function readjustShifts(shiftMap, x, y) {
		const direction = shiftMap[y]?.[x];
		if (!direction) return;
		const neighbors = [
			[[1, 5, 8], x - 1, y, [3, 7, 6]],
			[[2, 5, 6], x, y - 1, [4, 7, 8]],
			[[3, 7, 6], x + 1, y, [1, 5, 8]],
			[[4, 7, 8], x, y + 1, [2, 5, 6]]
		];
		for (const [dirs, qx, qy, removeShifts] of neighbors) {
			if (!dirs.includes(direction)) continue;
			if (shiftMap[qy]?.[qx] && removeShifts.includes(shiftMap[qy][qx])) {
				shiftMap[qy][qx] = 0;
			}
		}
	}

	let board = $state(GoBoardLib.fromDimensions(SIZE));
	let currentSign = $state(1);
	let consecutivePasses = $state(0);
	let status = $state('playing');
	let lastMove = $state(null);
	let winner = $state(null);
	let shiftMap = $state(emptyShiftMap(SIZE));
	let animatedVertex = $state(null);

	const signMap = $derived(board.signMap);
	const blackCaptures = $derived(board.getCaptures(1));
	const whiteCaptures = $derived(board.getCaptures(-1));

	const currentColor = $derived(currentSign === 1 ? 'black' : 'white');
	const opponentColor = $derived(currentSign === 1 ? 'white' : 'black');

	const currentCaptures = $derived(currentSign === 1 ? blackCaptures : whiteCaptures);
	const opponentCaptures = $derived(currentSign === 1 ? whiteCaptures : blackCaptures);

	function makeMove(x, y) {
		if (status !== 'playing') return;
		const vertex = [x, y];
		const analysis = board.analyzeMove(currentSign, vertex);
		if (analysis.overwrite || analysis.suicide || analysis.ko) return;

		const prevSignMap = board.signMap;
		try {
			board = board.makeMove(currentSign, vertex, {
				preventSuicide: true,
				preventOverwrite: true,
				preventKo: true
			});
		} catch {
			return;
		}

		shiftMap[y][x] = Math.ceil(Math.random() * 8);
		readjustShifts(shiftMap, x, y);

		for (let ry = 0; ry < SIZE; ry++) {
			for (let rx = 0; rx < SIZE; rx++) {
				if (prevSignMap[ry][rx] !== 0 && board.signMap[ry][rx] === 0) {
					shiftMap[ry][rx] = 0;
				}
			}
		}

		animatedVertex = vertex;
		lastMove = vertex;
		consecutivePasses = 0;
		currentSign = currentSign === 1 ? -1 : 1;
	}

	function pass() {
		if (status !== 'playing') return;
		consecutivePasses++;
		lastMove = null;
		animatedVertex = null;
		currentSign = currentSign === 1 ? -1 : 1;
		if (consecutivePasses >= 2) {
			status = 'gameover';
			winner = whiteCaptures + KOMI > blackCaptures ? -1 : 1;
		}
	}

	function resign() {
		if (status !== 'playing') return;
		status = 'gameover';
		winner = currentSign === 1 ? -1 : 1;
	}

	function newGame() {
		board = GoBoardLib.fromDimensions(SIZE);
		currentSign = 1;
		consecutivePasses = 0;
		status = 'playing';
		lastMove = null;
		winner = null;
		shiftMap = emptyShiftMap(SIZE);
		animatedVertex = null;
	}
</script>

<div class="round">
	<aside class="round__side">
		<div class="game__meta">
			<section>
				<div class="game__meta__infos" data-icon="&#xe015;">
					<div class="setup">Casual • {SIZE}×{SIZE} • Go</div>
				</div>
				<div class="game__meta__players">
					<div class="player color-icon is black text">Black</div>
					<div class="player color-icon is white text">White</div>
				</div>
			</section>
			{#if status === 'gameover'}
				<section class="status">
					{winner === 1 ? 'Black' : 'White'} is victorious.
				</section>
			{/if}
		</div>
	</aside>

	<div class="round__app">
		<div class="round__app__board">
			<GoBoard {signMap} {lastMove} {shiftMap} {animatedVertex} size={SIZE} onVertexClick={makeMove} />
		</div>

		<div class="round__app__table">
			<div class="ruser ruser-top color-icon is {opponentColor}">
				<i class="line"></i>
				<name>{opponentColor === 'black' ? 'Black' : 'White'}</name>
				{#if opponentCaptures > 0}
					<span class="material">+{opponentCaptures}</span>
				{/if}
			</div>

			<div class="rmoves">
				{#if status === 'playing'}
					<div class="message" data-icon={ICON_INFO}>
						<div>
							You play the {currentColor} stones
							<br /><strong>It's your turn!</strong>
						</div>
					</div>
				{:else}
					<div class="message" data-icon={ICON_INFO}>
						<div>
							{winner === 1 ? 'Black' : 'White'} wins<br />
							{#if winner === -1}by {KOMI} komi + {/if}captures.
						</div>
					</div>
				{/if}
			</div>

			<div class="rcontrols">
				{#if status === 'playing'}
					<button class="button button-metal" onclick={pass}>Pass</button>
					<button class="button button-red" onclick={resign}>Resign</button>
				{:else}
					<button class="button button-metal" onclick={newGame}>New game</button>
				{/if}
			</div>

			<div class="ruser ruser-bottom color-icon is {currentColor} active">
				<i class="line"></i>
				<name>{currentColor === 'black' ? 'Black' : 'White'}</name>
				{#if currentCaptures > 0}
					<span class="material">+{currentCaptures}</span>
				{/if}
			</div>
		</div>
	</div>
</div>
