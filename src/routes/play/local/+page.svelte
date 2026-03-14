<script>
	import { onMount, onDestroy } from 'svelte';
	import GoBoardLib from '@sabaki/go-board';
	import influence from '@sabaki/influence';
	import GoBoard from '$lib/GoBoard.svelte';
	import { page } from '$app/state';
	import { boardState } from '$lib/boardState.svelte.js';

	const VALID_SIZES = [9, 13, 19];
	const rawSize = Number(page.url.searchParams.get('size') ?? 19);
	const SIZE = VALID_SIZES.includes(rawSize) ? rawSize : 19;
	const KOMI = 6.5;

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
	let deadStones = $state([]);
	let blackApproved = $state(false);
	let whiteApproved = $state(false);
	let finalScore = $state(null);
	let boardContainerWidth = $state(0);
	const vertexSize = $derived(
		boardContainerWidth > 0 ? Math.floor(boardContainerWidth / (SIZE + 0.8)) : 24
	);

	let boardHistory = $state([GoBoardLib.fromDimensions(SIZE)]);
	let lastMoveHistory = $state([null]);
	let shiftMapHistory = $state([emptyShiftMap(SIZE)]);
	let viewPly = $state(null);

	const totalPly = $derived(boardHistory.length - 1);
	const currentViewPly = $derived(viewPly ?? totalPly);
	const isViewingHistory = $derived(viewPly !== null && viewPly < totalPly);

	const displayBoard = $derived(
		viewPly === null || viewPly >= totalPly ? board : (boardHistory[viewPly] ?? board)
	);
	const displayLastMove = $derived(
		viewPly === null || viewPly >= totalPly ? lastMove : (lastMoveHistory[viewPly] ?? null)
	);
	const displayShiftMap = $derived(
		viewPly === null || viewPly >= totalPly
			? shiftMap
			: (shiftMapHistory[viewPly] ?? emptyShiftMap(SIZE))
	);

	function jumpTo(ply) {
		const clamped = Math.max(0, Math.min(ply, totalPly));
		viewPly = clamped >= totalPly ? null : clamped;
	}
	function jumpFirst() {
		jumpTo(0);
	}
	function jumpPrev() {
		jumpTo(currentViewPly - 1);
	}
	function jumpNext() {
		jumpTo(currentViewPly + 1);
	}
	function jumpLast() {
		viewPly = null;
	}

	function recordSnapshot() {
		boardHistory.push(board);
		lastMoveHistory.push(lastMove);
		shiftMapHistory.push(shiftMap.map((row) => [...row]));
		if (isViewingHistory) viewPly = null;
	}

	function handleKeydown(e) {
		if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
		if (e.key === 'ArrowLeft') {
			e.preventDefault();
			jumpPrev();
		} else if (e.key === 'ArrowRight') {
			e.preventDefault();
			jumpNext();
		} else if (e.key === 'Home') {
			e.preventDefault();
			jumpFirst();
		} else if (e.key === 'End') {
			e.preventDefault();
			jumpLast();
		}
	}

	onMount(() => {
		document.addEventListener('keydown', handleKeydown);
	});
	onDestroy(() => {
		document.removeEventListener('keydown', handleKeydown);
	});

	const signMap = $derived(displayBoard.signMap);
	const blackCaptures = $derived(displayBoard.getCaptures(1));
	const whiteCaptures = $derived(displayBoard.getCaptures(-1));

	const currentColor = $derived(currentSign === 1 ? 'black' : 'white');
	const opponentColor = $derived(currentSign === 1 ? 'white' : 'black');

	const currentCaptures = $derived(currentSign === 1 ? blackCaptures : whiteCaptures);
	const opponentCaptures = $derived(currentSign === 1 ? whiteCaptures : blackCaptures);

	const scoreBoard = $derived.by(() => {
		if (status !== 'scoring') return board;
		const clone = board.clone();
		for (const [x, y] of deadStones) {
			const sign = clone.get([x, y]);
			if (sign === 0) continue;
			clone.set([x, y], 0);
			clone.setCaptures(-sign, (n) => n + 1);
		}
		return clone;
	});

	const areaMap = $derived(status === 'scoring' ? influence.areaMap(scoreBoard.signMap) : null);

	const score = $derived.by(() => {
		if (!areaMap) return null;
		let blackArea = 0;
		let whiteArea = 0;
		for (let y = 0; y < SIZE; y++) {
			for (let x = 0; x < SIZE; x++) {
				const z = areaMap[y][x];
				if (z > 0) blackArea++;
				if (z < 0) whiteArea++;
			}
		}
		const blackScore = blackArea;
		const whiteScore = whiteArea + KOMI;
		return { blackArea, whiteArea, blackScore, whiteScore };
	});

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
		recordSnapshot();
	}

	function toggleDeadGroup(x, y) {
		const sign = board.get([x, y]);
		if (sign === 0) return;
		const chain = board.getChain([x, y]);
		const chainKeys = new Set(chain.map(([cx, cy]) => `${cx},${cy}`));
		const currentDeadKeys = new Set(deadStones.map(([cx, cy]) => `${cx},${cy}`));
		const isCurrentlyDead = currentDeadKeys.has(`${x},${y}`);
		if (isCurrentlyDead) {
			deadStones = deadStones.filter(([cx, cy]) => !chainKeys.has(`${cx},${cy}`));
		} else {
			deadStones = [...deadStones, ...chain];
		}
		blackApproved = false;
		whiteApproved = false;
	}

	function handleVertexClick(x, y) {
		if (status === 'playing') makeMove(x, y);
		else if (status === 'scoring') toggleDeadGroup(x, y);
	}

	function pass() {
		if (status !== 'playing') return;
		consecutivePasses++;
		lastMove = null;
		animatedVertex = null;
		currentSign = currentSign === 1 ? -1 : 1;
		recordSnapshot();
		if (consecutivePasses >= 2) {
			status = 'scoring';
			deadStones = [];
			blackApproved = false;
			whiteApproved = false;
		}
	}

	function approveScore(playerSign) {
		if (playerSign === 1) blackApproved = true;
		else whiteApproved = true;
		if (blackApproved && whiteApproved) {
			finalScore = score;
			status = 'gameover';
			winner = score.blackScore > score.whiteScore ? 1 : -1;
		}
	}

	function resign() {
		if (status !== 'playing') return;
		status = 'gameover';
		winner = currentSign === 1 ? -1 : 1;
		finalScore = null;
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
		deadStones = [];
		blackApproved = false;
		whiteApproved = false;
		finalScore = null;
		boardHistory = [GoBoardLib.fromDimensions(SIZE)];
		lastMoveHistory = [null];
		shiftMapHistory = [emptyShiftMap(SIZE)];
		viewPly = null;
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
		<div class="round__app__board" bind:clientWidth={boardContainerWidth}>
			<GoBoard
				{signMap}
				lastMove={displayLastMove}
				shiftMap={displayShiftMap}
				animatedVertex={isViewingHistory ? null : animatedVertex}
				size={SIZE}
				{vertexSize}
				{areaMap}
				deadStones={status === 'scoring' ? deadStones : null}
				showCoords={boardState.showCoords}
				{currentSign}
				onVertexClick={isViewingHistory ? null : handleVertexClick}
			/>
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
				{#if isViewingHistory}
					<div class="history-indicator">
						Move {currentViewPly} of {totalPly}
					</div>
				{/if}
				{#if status === 'playing'}
					<div class="message" data-icon={ICON_INFO}>
						<div>
							You play the {currentColor} stones
							<br /><strong>It's your turn!</strong>
						</div>
					</div>
				{:else if status === 'scoring'}
					<div class="message" data-icon={ICON_INFO}>
						<div>
							Counting territory<br />
							<strong>Click stones to mark dead</strong>
						</div>
					</div>
					{#if score}
						<div class="score-breakdown">
							<div class="score-row">
								<span class="color-icon is black text">Black</span>
								<span>{score.blackArea}</span>
							</div>
							<div class="score-row">
								<span class="color-icon is white text">White</span>
								<span>{score.whiteArea} + {KOMI} = {score.whiteScore.toFixed(1)}</span>
							</div>
							<div class="score-verdict">
								{#if score.blackScore > score.whiteScore}
									Black leads by {(score.blackScore - score.whiteScore).toFixed(1)}
								{:else if score.whiteScore > score.blackScore}
									White leads by {(score.whiteScore - score.blackScore).toFixed(1)}
								{:else}
									Tied (jigo)
								{/if}
							</div>
						</div>
					{/if}
				{:else}
					<div class="message" data-icon={ICON_INFO}>
						<div>
							{winner === 1 ? 'Black' : 'White'} wins
							{#if finalScore}
								<br />{finalScore.blackScore.toFixed(1)} – {finalScore.whiteScore.toFixed(1)}
							{:else}
								<br />by resignation
							{/if}
						</div>
					</div>
				{/if}
			</div>

			<div class="rcontrols">
				{#if status === 'playing'}
					<button class="button button-metal" onclick={pass}>Pass</button>
					<button class="button button-red" onclick={resign}>Resign</button>
				{:else if status === 'scoring'}
					<button
						class="button"
						class:button-metal={!blackApproved}
						class:button-green={blackApproved}
						onclick={() => approveScore(1)}
						disabled={blackApproved}
					>
						{blackApproved ? 'Black ✓' : 'Black accepts'}
					</button>
					<button
						class="button"
						class:button-metal={!whiteApproved}
						class:button-green={whiteApproved}
						onclick={() => approveScore(-1)}
						disabled={whiteApproved}
					>
						{whiteApproved ? 'White ✓' : 'White accepts'}
					</button>
				{:else}
					<button class="button button-metal" onclick={newGame}>New game</button>
				{/if}
			</div>

			{#if totalPly > 0}
				<div class="rbuttons">
					<button
						class="fbt"
						data-icon="&#xe035;"
						disabled={currentViewPly <= 0}
						onclick={jumpFirst}
					></button>
					<button
						class="fbt"
						data-icon="&#xe037;"
						disabled={currentViewPly <= 0}
						onclick={jumpPrev}
					></button>
					<button
						class="fbt"
						data-icon="&#xe036;"
						disabled={currentViewPly >= totalPly}
						onclick={jumpNext}
					></button>
					<button
						class="fbt"
						data-icon="&#xe034;"
						disabled={currentViewPly >= totalPly}
						onclick={jumpLast}
					></button>
				</div>
			{/if}

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

<style>
	:global(#main-wrap) {
		display: block;
	}

	.history-indicator {
		text-align: center;
		padding: 0.3em;
		font-size: 0.85em;
		color: var(--c-font-dim);
		background: var(--c-bg-zebra);
		border-radius: 3px;
		margin-bottom: 0.5em;
	}
</style>
