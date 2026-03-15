<script>
	import { onMount, onDestroy } from 'svelte';
	import GoBoardLib from '@sabaki/go-board';
	import influence from '@sabaki/influence';
	import GoBoard from '$lib/GoBoard.svelte';
	import { page } from '$app/state';
	import { boardState } from '$lib/boardState.svelte.js';

	let { data } = $props();

	const VALID_SIZES = [9, 13, 19];
	const gameData = data.game;
	const defaultSize = gameData ? gameData.size : Number(page.url.searchParams.get('size') ?? 19);
	const SIZE = VALID_SIZES.includes(defaultSize) ? defaultSize : 19;

	function emptyMarkerMap(size) {
		return Array.from({ length: size }, () => new Array(size).fill(null));
	}

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

	const vertexSize = $derived(
		boardContainerWidth > 0 ? Math.floor(boardContainerWidth / (SIZE + 0.8)) : 24
	);

	const KOMI = 6.5;

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

	function startScoring() {
		status = 'scoring';
		deadStones = [];
		const am = influence.areaMap(currentNode.board.signMap);
		areaMap = am;
	}

	function stopScoring() {
		status = 'playing';
		deadStones = [];
		areaMap = null;
	}

	function toggleDeadGroup(x, y) {
		const sign = currentNode.board.get([x, y]);
		if (sign === 0) return;
		const chain = currentNode.board.getChain([x, y]);
		const chainKeys = new Set(chain.map(([cx, cy]) => `${cx},${cy}`));
		const currentDeadKeys = new Set(deadStones.map(([cx, cy]) => `${cx},${cy}`));
		const isCurrentlyDead = currentDeadKeys.has(`${x},${y}`);
		if (isCurrentlyDead) {
			deadStones = deadStones.filter(([cx, cy]) => !chainKeys.has(`${cx},${cy}`));
		} else {
			deadStones = [...deadStones, ...chain];
		}
		const clone = currentNode.board.clone();
		for (const [dx, dy] of deadStones) {
			const s = clone.get([dx, dy]);
			if (s !== 0) {
				clone.set([dx, dy], 0);
			}
		}
		areaMap = influence.areaMap(clone.signMap);
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

	const COL_LETTERS = 'ABCDEFGHJKLMNOPQRST';

	function formatVertex(vertex) {
		if (!vertex) return 'pass';
		const col = COL_LETTERS[vertex[0]];
		const row = SIZE - vertex[1];
		return `${col}${row}`;
	}
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

		<div class="ruser ruser-top color-icon is {currentSign === 1 ? 'white' : 'black'}">
			<i class="line"></i>
			<name>{currentSign === 1 ? 'White' : 'Black'}</name>
		</div>

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
						<span class="move-coord">{formatVertex(node.lastMove)}</span>
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
						<strong>
							{#if score.blackScore > score.whiteScore}
								B+{(score.blackScore - score.whiteScore).toFixed(1)}
							{:else}
								W+{(score.whiteScore - score.blackScore).toFixed(1)}
							{/if}
						</strong>
					</div>
				{/if}
			{:else}
				<button class="button button-metal" onclick={startScoring}>Score</button>
				<button class="button button-metal" onclick={clearBoard}>Clear</button>
			{/if}
		</div>

		<div class="rbuttons">
			<button
				class="fbt"
				data-icon="&#xe035;"
				disabled={!currentNode.parent}
				onclick={jumpFirst}
			></button>
			<button
				class="fbt"
				data-icon="&#xe037;"
				disabled={!currentNode.parent}
				onclick={jumpPrev}
			></button>
			<button
				class="fbt"
				data-icon="&#xe036;"
				disabled={currentNode.children.length === 0}
				onclick={jumpNext}
			></button>
			<button
				class="fbt"
				data-icon="&#xe034;"
				disabled={currentNode.children.length === 0}
				onclick={jumpLast}
			></button>
		</div>

		<div class="ruser ruser-bottom color-icon is {currentSign === 1 ? 'black' : 'white'} active">
			<i class="line"></i>
			<name>{currentSign === 1 ? 'Black' : 'White'}</name>
		</div>
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
