<script>
	import { onMount, onDestroy } from 'svelte';
	import GoBoardLib from '@sabaki/go-board';
	import influence from '@sabaki/influence';
	import GoBoard from '$lib/GoBoard.svelte';
	import PlayerStrip from '$lib/PlayerStrip.svelte';
	import NavigationButtons from '$lib/NavigationButtons.svelte';
	import { page } from '$app/state';
	import { boardState } from '$lib/boardState.svelte.js';
	import {
		colorName,
		computeScore,
		scoreVerdictShort,
		toggleDeadStones,
		buildScoreBoard,
		emptyMarkerMap,
		computeVertexSize,
		clampBoardSize,
		formatVertex
	} from '$lib/gameUtils.js';

	let { data } = $props();

	const gameData = data.game;
	const defaultSize = gameData ? gameData.size : Number(page.url.searchParams.get('size') ?? 19);
	const SIZE = clampBoardSize(defaultSize);
	const KOMI = 6.5;

	function makeNode(board, lastMove, markerMap, signToPlay, parent) {
		return { board, lastMove, markerMap, signToPlay, children: [], parent };
	}

	function buildTreeFromMoves(moves, size) {
		const treeRoot = makeNode(GoBoardLib.fromDimensions(size), null, emptyMarkerMap(size), 1, null);
		let node = treeRoot;
		for (const move of moves) {
			if (move.type === 'move') {
				let newBoard;
				try {
					newBoard = node.board.makeMove(node.signToPlay, [move.x, move.y], {
						preventSuicide: true,
						preventOverwrite: true,
						preventKo: true
					});
				} catch {
					continue;
				}
				const nextSign = node.signToPlay === 1 ? -1 : 1;
				const child = makeNode(newBoard, [move.x, move.y], emptyMarkerMap(size), nextSign, node);
				node.children.push(child);
				node = child;
			}
		}
		return { root: treeRoot, lastNode: node };
	}

	const initialTree = gameData && gameData.moves.length > 0
		? buildTreeFromMoves(gameData.moves, SIZE)
		: null;

	let root = initialTree ? initialTree.root : makeNode(GoBoardLib.fromDimensions(SIZE), null, emptyMarkerMap(SIZE), 1, null);
	let currentNode = $state.raw(initialTree ? initialTree.lastNode : root);
	let version = $state(0);
	let animatedVertex = $state(null);
	let boardContainerWidth = $state(0);

	let tool = $state('stone');

	const currentSign = $derived(currentNode.signToPlay);
	const vertexSize = $derived(computeVertexSize(boardContainerWidth, SIZE));

	const signMap = $derived(currentNode.board.signMap);
	const blackCaptures = $derived(currentNode.board.getCaptures(1));
	const whiteCaptures = $derived(currentNode.board.getCaptures(-1));
	const markerMap = $derived.by(() => { version; return currentNode.markerMap; });

	const childrenMap = $derived.by(() => {
		version;
		if (currentNode.children.length === 0) return null;
		const map = Array.from({ length: SIZE }, () => new Array(SIZE).fill(0));
		for (const child of currentNode.children) {
			if (!child.lastMove) continue;
			const [cx, cy] = child.lastMove;
			map[cy][cx] = currentSign;
		}
		return map;
	});

	let status = $state('playing');
	let deadStones = $state([]);
	let areaMap = $state(null);

	const score = $derived(areaMap ? computeScore(areaMap, SIZE, KOMI) : null);

	function startScoring() {
		status = 'scoring';
		deadStones = [];
		areaMap = influence.areaMap(currentNode.board.signMap);
	}

	function stopScoring() {
		status = 'playing';
		deadStones = [];
		areaMap = null;
	}

	function toggleDeadGroup(x, y) {
		deadStones = toggleDeadStones(currentNode.board, deadStones, x, y);
		const scoreBoard = buildScoreBoard(currentNode.board, deadStones);
		areaMap = influence.areaMap(scoreBoard.signMap);
	}

	const movePath = $derived.by(() => {
		version;
		const path = [];
		let node = currentNode;
		while (node.parent) {
			path.unshift(node);
			node = node.parent;
		}
		return path;
	});

	function makeMove(x, y) {
		const vertex = [x, y];
		const sign = currentNode.signToPlay;
		const analysis = currentNode.board.analyzeMove(sign, vertex);
		if (analysis.overwrite || analysis.suicide || analysis.ko) return;

		const existing = currentNode.children.find((child) => {
			return child.lastMove && child.lastMove[0] === x && child.lastMove[1] === y;
		});
		if (existing) {
			currentNode = existing;
			return;
		}

		let newBoard;
		try {
			newBoard = currentNode.board.makeMove(sign, vertex, {
				preventSuicide: true,
				preventOverwrite: true,
				preventKo: true
			});
		} catch {
			return;
		}

		const nextSign = sign === 1 ? -1 : 1;
		const newNode = makeNode(newBoard, vertex, emptyMarkerMap(SIZE), nextSign, currentNode);
		currentNode.children.push(newNode);
		currentNode = newNode;
		animatedVertex = vertex;
	}

	function toggleMarker(x, y) {
		const markerType = tool;
		const current = currentNode.markerMap[y][x];
		const newMap = currentNode.markerMap.map((row) => [...row]);
		newMap[y][x] = current === markerType ? null : markerType;
		currentNode.markerMap = newMap;
		version++;
	}

	function handleVertexClick(x, y) {
		if (status === 'scoring') {
			toggleDeadGroup(x, y);
			return;
		}
		if (tool === 'stone') {
			makeMove(x, y);
		} else {
			toggleMarker(x, y);
		}
	}

	function jumpPrev() {
		if (!currentNode.parent) return;
		currentNode = currentNode.parent;
		animatedVertex = null;
	}

	function jumpNext() {
		if (currentNode.children.length === 0) return;
		currentNode = currentNode.children[0];
		animatedVertex = null;
	}

	function jumpFirst() {
		let node = currentNode;
		while (node.parent) node = node.parent;
		currentNode = node;
		animatedVertex = null;
	}

	function jumpLast() {
		let node = currentNode;
		while (node.children.length > 0) node = node.children[0];
		currentNode = node;
		animatedVertex = null;
	}

	function nextVariation() {
		if (!currentNode.parent) return;
		const siblings = currentNode.parent.children;
		const idx = siblings.indexOf(currentNode);
		if (idx < siblings.length - 1) {
			currentNode = siblings[idx + 1];
		}
	}

	function prevVariation() {
		if (!currentNode.parent) return;
		const siblings = currentNode.parent.children;
		const idx = siblings.indexOf(currentNode);
		if (idx > 0) {
			currentNode = siblings[idx - 1];
		}
	}

	function clearBoard() {
		root = makeNode(GoBoardLib.fromDimensions(SIZE), null, emptyMarkerMap(SIZE), 1, null);
		currentNode = root;
		animatedVertex = null;
		stopScoring();
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
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			prevVariation();
		} else if (e.key === 'ArrowDown') {
			e.preventDefault();
			nextVariation();
		}
	}

	onMount(() => {
		document.addEventListener('keydown', handleKeydown);
	});
	onDestroy(() => {
		document.removeEventListener('keydown', handleKeydown);
	});
</script>

<div class="round">
	<aside class="round__side">
		<div class="game__meta">
			<section>
				<div class="game__meta__infos" data-icon="&#xe015;">
					<div class="setup">Analysis • {SIZE}×{SIZE}</div>
				</div>
			</section>
			<section class="analysis-tools">
				<div class="tool-buttons">
					<button
						class="button"
						class:button-green={tool === 'stone'}
						class:button-metal={tool !== 'stone'}
						onclick={() => (tool = 'stone')}
						title="Place stones"
					>
						Stone
					</button>
					<button
						class="button"
						class:button-green={tool === 'cross'}
						class:button-metal={tool !== 'cross'}
						onclick={() => (tool = 'cross')}
						title="Mark X"
					>
						✕
					</button>
					<button
						class="button"
						class:button-green={tool === 'circle'}
						class:button-metal={tool !== 'circle'}
						onclick={() => (tool = 'circle')}
						title="Mark circle"
					>
						○
					</button>
					<button
						class="button"
						class:button-green={tool === 'square'}
						class:button-metal={tool !== 'square'}
						onclick={() => (tool = 'square')}
						title="Mark square"
					>
						□
					</button>
				</div>
			</section>
			<section class="analysis-info">
				<div class="captures-display">
					<span class="color-icon is black text">
						{blackCaptures}
					</span>
					<span class="color-icon is white text">
						{whiteCaptures}
					</span>
				</div>
			</section>
		</div>
	</aside>

	<div class="round__app">
		<div class="round__app__table"></div>

		<div class="round__app__board" bind:clientWidth={boardContainerWidth}>
			<GoBoard
				{signMap}
				lastMove={currentNode.lastMove}
				{animatedVertex}
				size={SIZE}
				{vertexSize}
				showCoords={boardState.showCoords}
				{currentSign}
				{markerMap}
				{childrenMap}
				{areaMap}
				deadStones={status === 'scoring' ? deadStones : null}
				onVertexClick={handleVertexClick}
			/>
		</div>

		<PlayerStrip
			color={colorName(currentSign === 1 ? -1 : 1)}
			name={currentSign === 1 ? 'White' : 'Black'}
			position="top"
		/>

		<div class="rmoves">
			<div class="analysis-moves">
				{#each movePath as node, i}
					<button
						class="move-entry"
						class:active={node === currentNode}
						onclick={() => {
							currentNode = node;
							animatedVertex = null;
						}}
					>
						<span class="move-num">{i + 1}.</span>
						<span class="move-coord">{formatVertex(node.lastMove, SIZE)}</span>
						{#if node.children.length > 1}
							<span class="move-branches" title="{node.children.length} variations">⑂</span>
						{/if}
					</button>
				{/each}
				{#if movePath.length === 0}
					<div class="analysis-empty">Click the board to start analyzing</div>
				{/if}
			</div>
			{#if currentNode.parent && currentNode.parent.children.length > 1}
				{@const siblings = currentNode.parent.children}
				{@const idx = siblings.indexOf(currentNode)}
				<div class="variation-nav">
					Variation {idx + 1} of {siblings.length}
					<button class="var-nav-btn" onclick={prevVariation} disabled={idx <= 0}>◀</button>
					<button class="var-nav-btn" onclick={nextVariation} disabled={idx >= siblings.length - 1}>▶</button>
				</div>
			{/if}
		</div>

		<div class="rcontrols">
			{#if status === 'scoring'}
				<button class="button button-green" onclick={stopScoring}>Back to analysis</button>
				{#if score}
					<div class="score-display">
						<span class="color-icon is black text">{score.blackArea}</span>
						<span class="color-icon is white text">{score.whiteArea} + {KOMI} = {score.whiteScore.toFixed(1)}</span>
						<strong>{scoreVerdictShort(score)}</strong>
					</div>
				{/if}
			{:else}
				<button class="button button-metal" onclick={startScoring}>Score</button>
				<button class="button button-metal" onclick={clearBoard}>Clear</button>
			{/if}
		</div>

		<NavigationButtons
			canPrev={!!currentNode.parent}
			canNext={currentNode.children.length > 0}
			onFirst={jumpFirst}
			onPrev={jumpPrev}
			onNext={jumpNext}
			onLast={jumpLast}
		/>

		<PlayerStrip
			color={colorName(currentSign)}
			name={currentSign === 1 ? 'Black' : 'White'}
			position="bottom"
			active={true}
		/>
	</div>
</div>

<style>
	:global(#main-wrap) {
		display: block;
	}

	.analysis-tools {
		padding: 0.5em;
	}

	.tool-buttons {
		display: flex;
		gap: 0.4em;
	}

	.tool-buttons .button {
		flex: 1;
		font-size: 0.85em;
		padding: 0.4em 0.6em;
	}

	.analysis-info {
		padding: 0.5em;
	}

	.captures-display {
		display: flex;
		gap: 1em;
		font-size: 0.9em;
	}

	.analysis-moves {
		padding: 0.4em;
		display: flex;
		flex-wrap: wrap;
		gap: 2px;
		max-height: 200px;
		overflow-y: auto;
	}

	.analysis-empty {
		color: var(--c-font-dim);
		font-size: 0.85em;
		padding: 0.5em;
	}

	.move-entry {
		display: inline-flex;
		align-items: center;
		gap: 2px;
		padding: 2px 5px;
		font-size: 0.8em;
		background: none;
		border: 1px solid transparent;
		border-radius: 3px;
		cursor: pointer;
		color: var(--c-font);
	}

	.move-entry:hover {
		background: var(--c-bg-zebra);
	}

	.move-entry.active {
		background: var(--c-accent);
		color: #fff;
		border-color: var(--c-accent);
	}

	.move-num {
		color: var(--c-font-dim);
		font-size: 0.9em;
	}

	.move-entry.active .move-num {
		color: rgba(255, 255, 255, 0.7);
	}

	.move-branches {
		font-size: 0.9em;
		opacity: 0.6;
	}

	.variation-nav {
		display: flex;
		align-items: center;
		gap: 0.4em;
		padding: 0.3em 0.5em;
		font-size: 0.8em;
		color: var(--c-font-dim);
		background: var(--c-bg-zebra);
		border-radius: 3px;
		margin: 0.3em 0.4em;
	}

	.var-nav-btn {
		background: none;
		border: 1px solid var(--c-border);
		border-radius: 3px;
		color: var(--c-font);
		cursor: pointer;
		padding: 1px 6px;
		font-size: 0.9em;
	}

	.var-nav-btn:hover:not([disabled]) {
		background: var(--c-bg-zebra2, var(--c-bg-zebra));
	}

	.var-nav-btn[disabled] {
		opacity: 0.4;
		cursor: default;
	}

	.score-display {
		display: flex;
		flex-direction: column;
		gap: 0.2em;
		font-size: 0.85em;
		padding: 0.3em 0;
	}
</style>
