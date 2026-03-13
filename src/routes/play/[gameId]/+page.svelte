<script>
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/state';
	import GoBoardLib from '@sabaki/go-board';
	import influence from '@sabaki/influence';
	import GoBoard from '$lib/GoBoard.svelte';
	import Clock from '$lib/Clock.svelte';
	import { gameSocket } from '$lib/socket.svelte.js';
	import { boardState } from '$lib/boardState.svelte.js';

	let { data } = $props();
	const username = $derived(data.user?.username ?? '');

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

	const gameId = $derived(page.params.gameId);

	let boardContainerWidth = $state(0);
	let boardSize = $state(19);
	let board = $state(GoBoardLib.fromDimensions(boardSize));
	let currentSign = $state(1);
	let consecutivePasses = $state(0);
	let status = $state('waiting');
	let lastMove = $state(null);
	let winner = $state(null);
	let winnerResult = $state(null);
	let shiftMap = $state(emptyShiftMap(boardSize));
	let animatedVertex = $state(null);
	let timeControl = $state({ type: 'none' });
	let clockState = $state(null);
	let deadStones = $state([]);
	let blackApproved = $state(false);
	let whiteApproved = $state(false);
	let finalScore = $state(null);

	const vertexSize = $derived(boardContainerWidth > 0 ? Math.floor(boardContainerWidth / (boardSize + 0.8)) : 24);

	const signMap = $derived(board.signMap);
	const blackCaptures = $derived(board.getCaptures(1));
	const whiteCaptures = $derived(board.getCaptures(-1));

	const mySign = $derived(gameSocket.color === 'black' ? 1 : -1);
	const myColor = $derived(gameSocket.color ?? 'black');
	const oppColor = $derived(myColor === 'black' ? 'white' : 'black');
	const myCaptures = $derived(mySign === 1 ? blackCaptures : whiteCaptures);
	const opponentCaptures = $derived(mySign === 1 ? whiteCaptures : blackCaptures);
	const isMyTurn = $derived(status === 'playing' && currentSign === mySign);

	const myClockData = $derived(clockState?.[myColor] ?? null);
	const oppClockData = $derived(clockState?.[oppColor] ?? null);
	const myClockRunning = $derived(status === 'playing' && !!clockState?.turnStartedAt && clockState?.activeColor === myColor);
	const oppClockRunning = $derived(status === 'playing' && !!clockState?.turnStartedAt && clockState?.activeColor === oppColor);

	const initialMs = $derived(
		timeControl.type === 'none' || timeControl.type === 'correspondence'
			? null
			: (timeControl.initial ?? 0) * 1000
	);

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
		for (let y = 0; y < boardSize; y++) {
			for (let x = 0; x < boardSize; x++) {
				const z = areaMap[y][x];
				if (z > 0) blackArea++;
				if (z < 0) whiteArea++;
			}
		}
		return { blackArea, whiteArea, blackScore: blackArea, whiteScore: whiteArea + KOMI };
	});

	function replayMoves(moves, size) {
		let b = GoBoardLib.fromDimensions(size);
		let sign = 1;
		for (const move of moves) {
			if (move.type === 'move') {
				try { b = b.makeMove(sign, [move.x, move.y], { preventSuicide: true, preventOverwrite: true, preventKo: true }); } catch {}
			}
			sign = sign === 1 ? -1 : 1;
		}
		return b;
	}

	function applyMove(x, y, sign) {
		const vertex = [x, y];
		const prevSignMap = board.signMap;
		try {
			board = board.makeMove(sign, vertex, {
				preventSuicide: true,
				preventOverwrite: true,
				preventKo: true
			});
		} catch {
			return false;
		}
		shiftMap[y][x] = Math.ceil(Math.random() * 8);
		readjustShifts(shiftMap, x, y);
		for (let ry = 0; ry < boardSize; ry++) {
			for (let rx = 0; rx < boardSize; rx++) {
				if (prevSignMap[ry][rx] !== 0 && board.signMap[ry][rx] === 0) {
					shiftMap[ry][rx] = 0;
				}
			}
		}
		animatedVertex = vertex;
		lastMove = vertex;
		consecutivePasses = 0;
		currentSign = currentSign === 1 ? -1 : 1;
		return true;
	}

	function onVertexClick(x, y) {
		if (status === 'playing') {
			if (!isMyTurn) return;
			const analysis = board.analyzeMove(mySign, [x, y]);
			if (analysis.overwrite || analysis.suicide || analysis.ko) return;
			const ok = applyMove(x, y, mySign);
			if (ok) gameSocket.send({ type: 'move', x, y });
		} else if (status === 'scoring') {
			toggleDeadGroup(x, y);
		}
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
		gameSocket.send({ type: 'mark_dead', stones: deadStones });
	}

	function pass() {
		if (!isMyTurn) return;
		consecutivePasses++;
		lastMove = null;
		animatedVertex = null;
		currentSign = currentSign === 1 ? -1 : 1;
		gameSocket.send({ type: 'pass' });
		if (consecutivePasses >= 2) {
			status = 'scoring';
			deadStones = [];
			blackApproved = false;
			whiteApproved = false;
			gameSocket.send({ type: 'score_phase' });
		}
	}

	function resign() {
		status = 'gameover';
		winner = mySign === 1 ? -1 : 1;
		winnerResult = null;
		gameSocket.send({ type: 'resign' });
	}

	function approveScore() {
		if (myColor === 'black') blackApproved = true;
		else whiteApproved = true;
		gameSocket.send({ type: 'approve_score', signMap: board.signMap });
	}

	function handleMessage(msg) {
		if (msg.type === 'joined') {
			boardSize = msg.size ?? 19;
			timeControl = msg.timeControl ?? { type: 'none' };
			clockState = msg.clock ?? null;
			shiftMap = emptyShiftMap(boardSize);
			if (msg.moves && msg.moves.length > 0) {
				board = replayMoves(msg.moves, boardSize);
				consecutivePasses = 0;
				currentSign = msg.moves.length % 2 === 0 ? 1 : -1;
				const lastMoveEntry = msg.moves.at(-1);
				if (lastMoveEntry?.type === 'move') lastMove = [lastMoveEntry.x, lastMoveEntry.y];
			} else {
				board = GoBoardLib.fromDimensions(boardSize);
			}
			if (msg.opponent) status = 'playing';
		}
		if (msg.type === 'opponent_joined') {
		status = 'playing';
		if (msg.clock) clockState = msg.clock;
	}
		if (msg.type === 'opponent_left') {
			if (status !== 'gameover') status = 'abandoned';
		}
		if (msg.type === 'move') {
			const opponentSign = mySign === 1 ? -1 : 1;
			applyMove(msg.x, msg.y, opponentSign);
			if (msg.clock) clockState = msg.clock;
		}
		if (msg.type === 'pass') {
			consecutivePasses++;
			lastMove = null;
			animatedVertex = null;
			currentSign = currentSign === 1 ? -1 : 1;
			if (msg.clock) clockState = msg.clock;
		}
		if (msg.type === 'resign') {
			status = 'gameover';
			winner = mySign;
			winnerResult = null;
		}
		if (msg.type === 'timeout') {
			status = 'gameover';
			winner = msg.loser === myColor ? (mySign === 1 ? -1 : 1) : mySign;
			winnerResult = 'Time';
		}
		if (msg.type === 'score_phase') {
			status = 'scoring';
			deadStones = msg.deadStones ?? [];
			blackApproved = false;
			whiteApproved = false;
		}
		if (msg.type === 'dead_stones_update') {
			deadStones = msg.deadStones ?? [];
			blackApproved = false;
			whiteApproved = false;
		}
		if (msg.type === 'approve_update') {
			blackApproved = msg.blackApproved;
			whiteApproved = msg.whiteApproved;
		}
		if (msg.type === 'score_result') {
			finalScore = { blackScore: msg.blackScore, whiteScore: msg.whiteScore };
			winner = msg.winner === 'black' ? 1 : -1;
			winnerResult = msg.result;
			status = 'gameover';
		}
		if (msg.type === 'clock_update') {
		if (msg.clock) clockState = msg.clock;
	}
	if (msg.type === 'error') console.error('Game error:', msg.message);
	}

	onMount(() => {
		gameSocket.onMessage(handleMessage);
		gameSocket.connect();
		const timer = setTimeout(() => {
			gameSocket.send({ type: 'join', gameId, username: username || 'Anonymous' });
		}, 100);
		return () => clearTimeout(timer);
	});

	onDestroy(() => {
		gameSocket.onMessage(null);
		gameSocket.disconnect();
	});
</script>

<div class="round">
	<aside class="round__side">
		<div class="game__meta">
			<section>
				<div class="game__meta__infos" data-icon="&#xe015;">
					<div class="setup">Casual &bull; {boardSize}&times;{boardSize} &bull; Go</div>
				</div>
				<div class="game__meta__players">
					<div class="player color-icon is black text">
						{myColor === 'black' ? (username || 'You') : (gameSocket.opponent ?? '...')}
					</div>
					<div class="player color-icon is white text">
						{myColor === 'white' ? (username || 'You') : (gameSocket.opponent ?? '...')}
					</div>
				</div>
			</section>
			{#if status === 'gameover'}
				<section class="status">
					{#if winnerResult}
						{winnerResult} &mdash; {winner === mySign ? 'You win!' : 'You lose.'}
					{:else}
						{winner === mySign ? 'You win!' : 'You lose.'}
					{/if}
				</section>
			{/if}
			{#if status === 'abandoned'}
				<section class="status">Opponent left.</section>
			{/if}
		</div>
	</aside>

	<div class="round__app">
		<div class="round__app__board" bind:clientWidth={boardContainerWidth}>
			<GoBoard
				{signMap}
				{lastMove}
				{shiftMap}
				{animatedVertex}
				size={boardSize}
				{vertexSize}
				{areaMap}
				deadStones={status === 'scoring' ? deadStones : null}
				showCoords={boardState.showCoords}
				{currentSign}
				onVertexClick={status === 'playing' || status === 'scoring' ? onVertexClick : null}
			/>
		</div>

		<div class="round__app__table">
			<Clock clockData={oppClockData} running={oppClockRunning} position="top" {initialMs} turnStartedAt={clockState?.turnStartedAt} />
			<div class="ruser ruser-top color-icon is {oppColor}">
				<i class="line"></i>
				<name>{gameSocket.opponent ?? (status === 'waiting' ? 'Waiting...' : oppColor)}</name>
				{#if opponentCaptures > 0}
					<span class="material">+{opponentCaptures}</span>
				{/if}
			</div>

			<div class="rmoves">
				{#if status === 'waiting'}
					<div class="message" data-icon={ICON_INFO}>
						<div>
							You are <strong>{myColor}</strong><br />
							Share this link to invite a friend.
						</div>
					</div>
				{:else if status === 'playing'}
					<div class="message" data-icon={ICON_INFO}>
						<div>
							{#if isMyTurn}
								You play the {myColor} stones<br /><strong>It's your turn!</strong>
							{:else}
								Waiting for opponent...
							{/if}
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
					<div class="score-approvals">
						<span class="approval" class:approved={blackApproved}>Black {blackApproved ? '&#x2713;' : '&hellip;'}</span>
						<span class="approval" class:approved={whiteApproved}>White {whiteApproved ? '&#x2713;' : '&hellip;'}</span>
					</div>
				{:else if status === 'gameover'}
					<div class="message" data-icon={ICON_INFO}>
						<div>
							{winner === mySign ? 'You win' : 'You lose'}
							{#if winnerResult}
								<br />{winnerResult}
							{:else if finalScore}
								<br />{finalScore.blackScore.toFixed(1)} &ndash; {finalScore.whiteScore.toFixed(1)}
							{:else}
								<br />by resignation
							{/if}
						</div>
					</div>
				{:else if status === 'abandoned'}
					<div class="message" data-icon={ICON_INFO}>
						<div>Your opponent has left the game.</div>
					</div>
				{/if}
			</div>

			<div class="rcontrols">
				{#if status === 'playing'}
					<button class="button button-metal" onclick={pass} disabled={!isMyTurn}>Pass</button>
					<button class="button button-red" onclick={resign}>Resign</button>
				{:else if status === 'scoring'}
					{@const myApproved = myColor === 'black' ? blackApproved : whiteApproved}
					<button
						class="button"
						class:button-metal={!myApproved}
						class:button-green={myApproved}
						onclick={approveScore}
						disabled={myApproved}
					>
						{myApproved ? 'Score accepted' : 'Accept score'}
					</button>
				{/if}
			</div>

			<div class="ruser ruser-bottom color-icon is {myColor} active">
				<i class="line"></i>
				<name>{username || 'You'}</name>
				{#if myCaptures > 0}
					<span class="material">+{myCaptures}</span>
				{/if}
			</div>
			<Clock clockData={myClockData} running={myClockRunning} position="bottom" {initialMs} turnStartedAt={clockState?.turnStartedAt} />
		</div>
	</div>
</div>

<style>
	:global(#main-wrap) {
		display: block;
	}

	.score-approvals {
		display: flex;
		gap: 1em;
		padding: 0.5em 1em;
		justify-content: center;
	}

	.approval {
		color: var(--c-font-dim);
		font-size: 0.9em;
	}

	.approval.approved {
		color: var(--c-good);
		font-weight: bold;
	}
</style>
