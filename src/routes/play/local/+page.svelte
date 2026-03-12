<script>
	import GoBoardLib from '@sabaki/go-board';
	import GoBoard from '$lib/GoBoard.svelte';

	const SIZE = 19;
	const KOMI = 6.5;

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

	const turnLabel = $derived(
		status === 'gameover'
			? winner === 1
				? 'Black wins'
				: 'White wins'
			: currentSign === 1
				? 'Black to play'
				: 'White to play'
	);

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

<div class="go-container">
	<GoBoard {signMap} {lastMove} {shiftMap} {animatedVertex} size={SIZE} onVertexClick={makeMove} />

	<div class="go-side">
		<div class="go-turn">{turnLabel}</div>

		<div class="go-captures">
			<span>Black captures: {blackCaptures}</span>
			<span>White captures: {whiteCaptures}</span>
		</div>

		{#if status === 'playing'}
			<div class="go-actions">
				<button class="button button-metal" onclick={pass}>Pass</button>
				<button class="button button-metal" onclick={resign}>Resign</button>
			</div>
		{/if}

		{#if status === 'gameover'}
			<div class="go-message">
				{winner === 1 ? 'Black' : 'White'} wins by {winner === -1 ? `${KOMI} komi + ` : ''}captures.
			</div>
			<button class="button button-metal" onclick={newGame}>New game</button>
		{/if}
	</div>
</div>
