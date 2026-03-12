<script>
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/state';
	import GoBoardLib from '@sabaki/go-board';
	import GoBoard from '$lib/GoBoard.svelte';
	import { gameSocket } from '$lib/socket.svelte.js';
	import { getUsername } from '$lib/user.svelte.js';

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
	const username = $derived(getUsername());

	// boardSize comes from the 'joined' message; placeholder 19 until then.
	let boardSize = $state(19);
	let board = $state(GoBoardLib.fromDimensions(boardSize));
	let currentSign = $state(1); // whose turn it is (1=black, -1=white)
	let consecutivePasses = $state(0);
	let status = $state('waiting'); // 'waiting' | 'playing' | 'gameover' | 'abandoned'
	let lastMove = $state(null);
	let winner = $state(null);
	let shiftMap = $state(emptyShiftMap(boardSize));
	let animatedVertex = $state(null);

	const signMap = $derived(board.signMap);
	const blackCaptures = $derived(board.getCaptures(1));
	const whiteCaptures = $derived(board.getCaptures(-1));

	const mySign = $derived(gameSocket.color === 'black' ? 1 : -1);
	const myColor = $derived(gameSocket.color ?? 'black');
	const opponentColor = $derived(myColor === 'black' ? 'white' : 'black');
	const myCaptures = $derived(mySign === 1 ? blackCaptures : whiteCaptures);
	const opponentCaptures = $derived(mySign === 1 ? whiteCaptures : blackCaptures);
	const isMyTurn = $derived(status === 'playing' && currentSign === mySign);

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
		if (!isMyTurn) return;
		const analysis = board.analyzeMove(mySign, [x, y]);
		if (analysis.overwrite || analysis.suicide || analysis.ko) return;
		const ok = applyMove(x, y, mySign);
		if (ok) gameSocket.send({ type: 'move', x, y });
	}

	function pass() {
		if (!isMyTurn) return;
		consecutivePasses++;
		lastMove = null;
		animatedVertex = null;
		currentSign = currentSign === 1 ? -1 : 1;
		gameSocket.send({ type: 'pass' });
		if (consecutivePasses >= 2) endByPasses();
	}

	function resign() {
		if (!isMyTurn) return;
		status = 'gameover';
		winner = mySign === 1 ? -1 : 1;
		gameSocket.send({ type: 'resign' });
	}

	function endByPasses() {
		status = 'gameover';
		winner = whiteCaptures + KOMI > blackCaptures ? -1 : 1;
	}

	function handleMessage(msg) {
		if (msg.type === 'joined') {
			boardSize = msg.size ?? 19;
			board = GoBoardLib.fromDimensions(boardSize);
			shiftMap = emptyShiftMap(boardSize);
			if (msg.opponent) status = 'playing';
		}
		if (msg.type === 'opponent_joined') {
			status = 'playing';
		}
		if (msg.type === 'opponent_left') {
			status = 'abandoned';
		}
		if (msg.type === 'move') {
			const opponentSign = mySign === 1 ? -1 : 1;
			applyMove(msg.x, msg.y, opponentSign);
		}
		if (msg.type === 'pass') {
			consecutivePasses++;
			lastMove = null;
			animatedVertex = null;
			currentSign = currentSign === 1 ? -1 : 1;
			if (consecutivePasses >= 2) endByPasses();
		}
		if (msg.type === 'resign') {
			status = 'gameover';
			winner = mySign; // opponent resigned, I win
		}
		if (msg.type === 'error') {
			console.error('Game error:', msg.message);
		}
	}

	onMount(() => {
		gameSocket.onMessage(handleMessage);
		gameSocket.connect();
		// Small delay to let the connection open before sending join
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
					<div class="setup">Casual • {boardSize}×{boardSize} • Go</div>
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
					{winner === mySign ? 'You win!' : 'You lose.'}
				</section>
			{/if}
			{#if status === 'abandoned'}
				<section class="status">Opponent left.</section>
			{/if}
		</div>
	</aside>

	<div class="round__app">
		<div class="round__app__board">
			<GoBoard
				{signMap}
				{lastMove}
				{shiftMap}
				{animatedVertex}
				size={boardSize}
				onVertexClick={isMyTurn ? onVertexClick : null}
			/>
		</div>

		<div class="round__app__table">
			<div class="ruser ruser-top color-icon is {opponentColor}">
				<i class="line"></i>
				<name>{gameSocket.opponent ?? (status === 'waiting' ? 'Waiting...' : opponentColor)}</name>
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
				{:else if status === 'gameover'}
					<div class="message" data-icon={ICON_INFO}>
						<div>
							{winner === mySign ? 'You win' : 'You lose'}<br />
							{#if winner === -1}by {KOMI} komi + {/if}captures.
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
					<button class="button button-red" onclick={resign} disabled={!isMyTurn}>Resign</button>
				{/if}
			</div>

			<div class="ruser ruser-bottom color-icon is {myColor} active">
				<i class="line"></i>
				<name>{username || 'You'}</name>
				{#if myCaptures > 0}
					<span class="material">+{myCaptures}</span>
				{/if}
			</div>
		</div>
	</div>
</div>
