<script>
	import { untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import GoBoardLib from '@sabaki/go-board';
	import influence from '@sabaki/influence';
	import GoBoard from '$lib/GoBoard.svelte';
	import Clock from '$lib/Clock.svelte';
	import { gameSocket } from '$lib/socket.svelte.js';
	import { boardState } from '$lib/boardState.svelte.js';
	import { getGuestId } from '$lib/guestId.js';
	import { GameState } from '$lib/gameLogic.svelte.js';
	import GameChat from '$lib/GameChat.svelte';

	let { data } = $props();
	const username = $derived(data.user?.username ?? '');
	const displayName = $derived(username || getGuestId());

	const KOMI = 6.5;
	const ICON_INFO = '\ue060';

	const gameId = $derived(page.params.gameId);
	const isLocal = $derived(data.game.gameType === 'local');

	let boardContainerWidth = $state(0);
	let chatMessages = $state(data.chat ?? []);

	function handleChatSend(text) {
		gameSocket.send({ type: 'chat', text });
		chatMessages.push({ user: displayName, text });
	}

	let gs = $state(new GameState({ isLocal, onNavigate: goto }));

	const vertexSize = $derived(
		boardContainerWidth > 0 ? Math.floor(boardContainerWidth / (gs.boardSize + 0.8)) : 24
	);

	const displayBoard = $derived(gs.viewBoard);
	const signMap = $derived(displayBoard.signMap);
	const blackCaptures = $derived(displayBoard.getCaptures(1));
	const whiteCaptures = $derived(displayBoard.getCaptures(-1));

	const isSpectator = $derived(!isLocal && data.viewerColor === null);
	const mySign = $derived(isLocal ? 1 : (gs.mySign ?? -1));
	const myColor = $derived(mySign === 1 ? 'black' : 'white');
	const oppColor = $derived(myColor === 'black' ? 'white' : 'black');
	const myCaptures = $derived(mySign === 1 ? blackCaptures : whiteCaptures);
	const opponentCaptures = $derived(mySign === 1 ? whiteCaptures : blackCaptures);

	const isCorrGame = $derived(gs.timeControl.type === 'correspondence');
	const isMyTurn = $derived(
		gs.status === 'playing' &&
			gs.timedOutColor === null &&
			(isLocal || gs.currentSign === mySign) &&
			(!isCorrGame || gs.corrState?.activeColor === myColor)
	);

	function handleTimeout(loser) {
		gs.timedOutColor = loser;
		gameSocket.send({ type: 'flag', loser });
	}

	function formatCorrDeadline(deadline) {
		if (!deadline) return '';
		const remaining = deadline - Date.now();
		if (remaining <= 0) return 'Overdue';
		const days = Math.floor(remaining / 86400000);
		const hours = Math.floor((remaining % 86400000) / 3600000);
		if (days > 0) return `${days}d ${hours}h remaining`;
		const minutes = Math.floor((remaining % 3600000) / 60000);
		if (hours > 0) return `${hours}h ${minutes}m remaining`;
		return `${minutes}m remaining`;
	}

	const previewClockData = $derived(
		initialMs ? { mainMs: initialMs, byoMs: 0, byoPeriods: 0, inByoYomi: false } : null
	);
	const myClockData = $derived(gs.clockState?.[myColor] ?? previewClockData);
	const oppClockData = $derived(gs.clockState?.[oppColor] ?? previewClockData);
	const myClockRunning = $derived(
		gs.status === 'playing' &&
			!!gs.clockState?.turnStartedAt &&
			gs.clockState?.activeColor === myColor
	);
	const oppClockRunning = $derived(
		gs.status === 'playing' &&
			!!gs.clockState?.turnStartedAt &&
			gs.clockState?.activeColor === oppColor
	);

	const initialMs = $derived(
		gs.timeControl.type === 'none' || gs.timeControl.type === 'correspondence'
			? null
			: (gs.timeControl.initial ?? 0) * 1000
	);

	const scoreBoard = $derived.by(() => {
		if (gs.status !== 'scoring') return displayBoard;
		const clone = gs.board.clone();
		for (const [x, y] of gs.deadStones) {
			const sign = clone.get([x, y]);
			if (sign === 0) continue;
			clone.set([x, y], 0);
			clone.setCaptures(-sign, (n) => n + 1);
		}
		return clone;
	});

	const areaMap = $derived(gs.status === 'scoring' ? influence.areaMap(scoreBoard.signMap) : null);

	const score = $derived.by(() => {
		if (!areaMap) return null;
		let blackArea = 0;
		let whiteArea = 0;
		for (let y = 0; y < gs.boardSize; y++) {
			for (let x = 0; x < gs.boardSize; x++) {
				const z = areaMap[y][x];
				if (z > 0) blackArea++;
				if (z < 0) whiteArea++;
			}
		}
		return { blackArea, whiteArea, blackScore: blackArea, whiteScore: whiteArea + KOMI };
	});

	function onVertexClick(x, y) {
		if (gs.status === 'playing') {
			if (!isMyTurn) return;
			const movingSign = isLocal ? gs.currentSign : mySign;
			const movingColor = movingSign === 1 ? 'black' : 'white';
			const analysis = gs.board.analyzeMove(movingSign, [x, y]);
			if (analysis.overwrite || analysis.suicide || analysis.ko) return;
			const ok = gs.applyMove(x, y, movingSign);
			if (ok)
				gameSocket.send(
					isLocal ? { type: 'move', x, y, color: movingColor } : { type: 'move', x, y }
				);
		} else if (gs.status === 'scoring') {
			toggleDeadGroup(x, y);
		}
	}

	function toggleDeadGroup(x, y) {
		const sign = gs.board.get([x, y]);
		if (sign === 0) return;
		const chain = gs.board.getChain([x, y]);
		const chainKeys = new Set(chain.map(([cx, cy]) => `${cx},${cy}`));
		const currentDeadKeys = new Set(gs.deadStones.map(([cx, cy]) => `${cx},${cy}`));
		const isCurrentlyDead = currentDeadKeys.has(`${x},${y}`);
		if (isCurrentlyDead) {
			gs.deadStones = gs.deadStones.filter(([cx, cy]) => !chainKeys.has(`${cx},${cy}`));
		} else {
			gs.deadStones = [...gs.deadStones, ...chain];
		}
		gs.blackApproved = false;
		gs.whiteApproved = false;
		gameSocket.send({ type: 'mark_dead', stones: gs.deadStones });
	}

	function pass() {
		if (!isMyTurn) return;
		const movingColor = isLocal ? (gs.currentSign === 1 ? 'black' : 'white') : myColor;
		gs.consecutivePasses++;
		gs.lastMove = null;
		gs.animatedVertex = null;
		gs.currentSign = gs.currentSign === 1 ? -1 : 1;
		gs.recordPass();
		gameSocket.send(isLocal ? { type: 'pass', color: movingColor } : { type: 'pass' });
		if (gs.consecutivePasses >= 2) {
			gs.status = 'scoring';
			gs.deadStones = [];
			gs.blackApproved = false;
			gs.whiteApproved = false;
			gameSocket.send({ type: 'score_phase' });
		}
	}

	function abort() {
		gameSocket.send({ type: 'abort' });
	}

	function resign() {
		gs.status = 'gameover';
		gs.winner = mySign === 1 ? -1 : 1;
		gs.winnerResult = null;
		gameSocket.send({ type: 'resign' });
	}

	function approveScore() {
		if (myColor === 'black') gs.blackApproved = true;
		else gs.whiteApproved = true;
		gameSocket.send({ type: 'approve_score', signMap: gs.board.signMap });
	}

	function handleKeydown(e) {
		if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
		if (e.key === 'ArrowLeft') {
			e.preventDefault();
			gs.jumpPrev();
		} else if (e.key === 'ArrowRight') {
			e.preventDefault();
			gs.jumpNext();
		} else if (e.key === 'Home') {
			e.preventDefault();
			gs.jumpFirst();
		} else if (e.key === 'End') {
			e.preventDefault();
			gs.jumpLast();
		}
	}

	$effect(() => {
		const currentGameId = gameId;

		untrack(() => {
			gs.initFromData(data.game, data.viewerColor);
			chatMessages = data.chat ?? [];

			const isLive = ['waiting', 'playing', 'scoring'].includes(data.game.status);
			if (isLive) {
				gameSocket.onMessage((msg) => {
					gs.handleMessage(msg);
					if (msg.type === 'chat') {
						chatMessages.push({ user: msg.user, text: msg.text });
					}
				});
				gameSocket.connect({ type: 'join', gameId: currentGameId, username: displayName });
			}

			const mainWrap = document.getElementById('main-wrap');
			if (mainWrap) mainWrap.style.display = 'block';

			document.addEventListener('keydown', handleKeydown);
		});

		return () => {
			const mainWrap = document.getElementById('main-wrap');
			if (mainWrap) mainWrap.style.display = '';
			document.removeEventListener('keydown', handleKeydown);
			gameSocket.onMessage(null);
			gameSocket.disconnect();
		};
	});
</script>

<div class="round">
	<aside class="round__side">
		<div class="game__meta">
			<section>
				<div class="game__meta__infos" data-icon="&#xe015;">
					<div class="setup">Casual &bull; {gs.boardSize}&times;{gs.boardSize} &bull; Go</div>
				</div>
				<div class="game__meta__players">
					<div class="player color-icon is black text">
						{isLocal
							? 'Black'
							: isSpectator
								? (data.game.blackName ?? 'Black')
								: myColor === 'black'
									? displayName
									: (gameSocket.opponent ?? data.game.blackName ?? '...')}
					</div>
					<div class="player color-icon is white text">
						{isLocal
							? 'White'
							: isSpectator
								? (data.game.whiteName ?? 'White')
								: myColor === 'white'
									? displayName
									: (gameSocket.opponent ?? data.game.whiteName ?? '...')}
					</div>
				</div>
			</section>
			{#if gs.status === 'gameover'}
				<section class="status">
					{#if isLocal}
						{gs.winner === 1 ? 'Black' : 'White'} wins{gs.winnerResult ? ` — ${gs.winnerResult}` : ''}.
					{:else if gs.winnerResult}
						{gs.winnerResult} &mdash; {gs.winner === mySign ? 'You win!' : 'You lose.'}
					{:else}
						{gs.winner === mySign ? 'You win!' : 'You lose.'}
					{/if}
				</section>
			{/if}
			{#if gs.status === 'abandoned'}
				<section class="status">Opponent left.</section>
			{/if}
			{#if gs.status === 'aborted'}
				<section class="status">Game aborted.</section>
			{/if}
		</div>
		<GameChat
			{username}
			{gameId}
			gameStatus={gs.status}
			bind:messages={chatMessages}
			initialNote={data.note ?? ''}
			onSend={handleChatSend}
		/>
	</aside>

	<div class="round__app">
		<div class="round__app__table"></div>

		<div class="round__app__board" bind:clientWidth={boardContainerWidth}>
			<GoBoard
				{signMap}
				lastMove={gs.viewLastMove}
				shiftMap={gs.viewShiftMap}
				animatedVertex={gs.isViewingHistory ? null : gs.animatedVertex}
				size={gs.boardSize}
				{vertexSize}
				{areaMap}
				deadStones={gs.status === 'scoring' ? gs.deadStones : null}
				showCoords={boardState.showCoords}
				currentSign={gs.currentSign}
				onVertexClick={!gs.isViewingHistory && (gs.status === 'playing' || gs.status === 'scoring') ? onVertexClick : null}
			/>
		</div>

		{#if !isCorrGame}
			<Clock
				clockData={oppClockData}
				running={oppClockRunning}
				position="top"
				{initialMs}
				turnStartedAt={gs.clockState?.turnStartedAt}
				onTimeout={isLocal ? () => handleTimeout(oppColor) : null}
			/>
		{/if}

		<div class="ruser ruser-top color-icon is {isSpectator ? 'black' : oppColor}">
			<i class="line"></i>
			<name
				>{isLocal
					? oppColor === 'white'
						? (data.game.whiteName ?? 'White')
						: (data.game.blackName ?? 'Black')
					: isSpectator
						? (data.game.blackName ?? 'Black')
						: (gameSocket.opponent ?? (gs.status === 'waiting' ? 'Waiting...' : oppColor))}</name
			>
			{#if opponentCaptures > 0}
				<span class="material">+{opponentCaptures}</span>
			{/if}
		</div>

		<div class="rmoves">
			{#if gs.isViewingHistory}
				<div class="history-indicator">
					Move {gs.currentViewPly} of {gs.totalPly}
				</div>
			{/if}
			{#if gs.status === 'waiting'}
				<div class="message" data-icon={ICON_INFO}>
					<div>
						You are <strong>{myColor}</strong><br />
						Share this link to invite a friend.
					</div>
				</div>
			{:else if gs.status === 'playing'}
				<div class="message" data-icon={ICON_INFO}>
					<div>
						{#if isMyTurn}
							You play the {myColor} stones<br /><strong>It's your turn!</strong>
							{#if isCorrGame && gs.corrState?.turnDeadline}
								<br /><span class="corr-deadline"
									>{formatCorrDeadline(gs.corrState.turnDeadline)}</span
								>
							{/if}
						{:else}
							Waiting for opponent...
							{#if isCorrGame && gs.corrState?.turnDeadline}
								<br /><span class="corr-deadline"
									>{formatCorrDeadline(gs.corrState.turnDeadline)}</span
								>
							{/if}
						{/if}
					</div>
				</div>
			{:else if gs.status === 'scoring'}
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
					<span class="approval" class:approved={gs.blackApproved}
						>Black {gs.blackApproved ? '&#x2713;' : '&hellip;'}</span
					>
					<span class="approval" class:approved={gs.whiteApproved}
						>White {gs.whiteApproved ? '&#x2713;' : '&hellip;'}</span
					>
				</div>
			{:else if gs.status === 'gameover'}
				<div class="message" data-icon={ICON_INFO}>
					<div>
						{gs.winner === mySign ? 'You win' : 'You lose'}
						{#if gs.winnerResult}
							<br />{gs.winnerResult}
						{:else if gs.finalScore}
							<br />{gs.finalScore.blackScore.toFixed(1)} &ndash; {gs.finalScore.whiteScore.toFixed(1)}
						{:else}
							<br />by resignation
						{/if}
					</div>
				</div>
			{:else if gs.status === 'abandoned'}
				<div class="message" data-icon={ICON_INFO}>
					<div>Your opponent has left the game.</div>
				</div>
			{:else if gs.status === 'aborted'}
				<div class="message" data-icon={ICON_INFO}>
					<div>This game was aborted.</div>
				</div>
			{/if}
		</div>

		<div class="rcontrols">
			{#if gs.status === 'waiting'}
				<button class="button button-red" onclick={abort}>Abort</button>
			{:else if gs.status === 'playing'}
				<button class="button button-metal" onclick={pass} disabled={!isMyTurn}>Pass</button>
				<button class="button button-red" onclick={resign}>Resign</button>
			{:else if gs.status === 'scoring'}
				{#if isLocal}
					<button
						class="button"
						class:button-metal={!gs.blackApproved}
						class:button-green={gs.blackApproved}
						onclick={() => {
							gs.blackApproved = true;
							gameSocket.send({ type: 'approve_score', color: 'black', signMap: gs.board.signMap });
						}}
						disabled={gs.blackApproved}
					>
						{gs.blackApproved ? 'Black ✓' : 'Black accepts'}
					</button>
					<button
						class="button"
						class:button-metal={!gs.whiteApproved}
						class:button-green={gs.whiteApproved}
						onclick={() => {
							gs.whiteApproved = true;
							gameSocket.send({ type: 'approve_score', color: 'white', signMap: gs.board.signMap });
						}}
						disabled={gs.whiteApproved}
					>
						{gs.whiteApproved ? 'White ✓' : 'White accepts'}
					</button>
				{:else}
					{@const myApproved = myColor === 'black' ? gs.blackApproved : gs.whiteApproved}
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
			{/if}
		</div>

		{#if gs.totalPly > 0}
			<div class="rbuttons">
				<button
					class="fbt"
					data-icon="&#xe035;"
					disabled={gs.currentViewPly <= 0}
					onclick={() => gs.jumpFirst()}
				></button>
				<button
					class="fbt"
					data-icon="&#xe037;"
					disabled={gs.currentViewPly <= 0}
					onclick={() => gs.jumpPrev()}
				></button>
				<button
					class="fbt"
					data-icon="&#xe036;"
					disabled={gs.currentViewPly >= gs.totalPly}
					onclick={() => gs.jumpNext()}
				></button>
				<button
					class="fbt"
					data-icon="&#xe034;"
					disabled={gs.currentViewPly >= gs.totalPly}
					onclick={() => gs.jumpLast()}
				></button>
			</div>
		{/if}

		<div class="ruser ruser-bottom color-icon is {isSpectator ? 'white' : myColor}">
			<i class="line"></i>
			<name>{isLocal ? 'Black' : isSpectator ? (data.game.whiteName ?? 'White') : displayName}</name>
			{#if myCaptures > 0}
				<span class="material">+{myCaptures}</span>
			{/if}
		</div>

		{#if !isCorrGame}
			<Clock
				clockData={myClockData}
				running={myClockRunning}
				position="bottom"
				{initialMs}
				turnStartedAt={gs.clockState?.turnStartedAt}
				onTimeout={() => handleTimeout(myColor)}
			/>
		{/if}
	</div>
</div>

<style>
	.corr-deadline {
		font-size: 0.85em;
		color: var(--c-font-dim);
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
