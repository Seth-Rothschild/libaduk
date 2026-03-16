<script>
	import { untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import influence from '@sabaki/influence';
	import GoBoard from '$lib/GoBoard.svelte';
	import Clock from '$lib/Clock.svelte';
	import PlayerStrip from '$lib/PlayerStrip.svelte';
	import NavigationButtons from '$lib/NavigationButtons.svelte';
	import ScoreBreakdown from '$lib/ScoreBreakdown.svelte';
	import { gameSocket } from '$lib/socket.svelte.js';
	import { boardState } from '$lib/boardState.svelte.js';
	import { getGuestId } from '$lib/guestId.js';
	import { GameState } from '$lib/gameLogic.svelte.js';
	import GameChat from '$lib/GameChat.svelte';
	import {
		colorName,
		computeScore,
		buildScoreBoard,
		toggleDeadStones,
		formatCorrDeadline,
		computeVertexSize
	} from '$lib/gameUtils.js';

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

	const vertexSize = $derived(computeVertexSize(boardContainerWidth, gs.boardSize));
	const displayBoard = $derived(gs.viewBoard);
	const signMap = $derived(displayBoard.signMap);
	const blackCaptures = $derived(displayBoard.getCaptures(1));
	const whiteCaptures = $derived(displayBoard.getCaptures(-1));

	const isSpectator = $derived(!isLocal && gs.mySign === null);
	const mySign = $derived(isLocal ? 1 : (gs.mySign ?? -1));
	const myColor = $derived(colorName(mySign));
	const oppColor = $derived(myColor === 'black' ? 'white' : 'black');
	const myCaptures = $derived(mySign === 1 ? blackCaptures : whiteCaptures);
	const opponentCaptures = $derived(mySign === 1 ? whiteCaptures : blackCaptures);

	const isCorrGame = $derived(gs.timeControl.type === 'correspondence');
	const isMyTurn = $derived(
		!isSpectator &&
			gs.status === 'playing' &&
			gs.timedOutColor === null &&
			(isLocal || gs.currentSign === mySign) &&
			(!isCorrGame || gs.corrState?.activeColor === myColor)
	);

	function handleTimeout(loser) {
		gs.timedOutColor = loser;
		gameSocket.send({ type: 'flag', loser });
	}

	const hasClock = $derived(
		gs.timeControl.type !== 'none' && gs.timeControl.type !== 'correspondence'
	);
	const initialMs = $derived(hasClock ? (gs.timeControl.initial ?? 0) * 1000 : null);
	const previewClockData = $derived.by(() => {
		if (!hasClock) return null;
		const mainMs = (gs.timeControl.initial ?? 0) * 1000;
		const isByoyomi = gs.timeControl.type === 'byoyomi';
		return {
			mainMs,
			byoMs: isByoyomi ? (gs.timeControl.periodTime ?? 30) * 1000 : 0,
			byoPeriods: isByoyomi ? (gs.timeControl.periods ?? 5) : 0,
			inByoYomi: isByoyomi && mainMs === 0
		};
	});
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

	const scoreBoard = $derived.by(() => {
		if (gs.status !== 'scoring') return displayBoard;
		return buildScoreBoard(gs.board, gs.deadStones);
	});

	const areaMap = $derived(gs.status === 'scoring' ? influence.areaMap(scoreBoard.signMap) : null);
	const score = $derived(areaMap ? computeScore(areaMap, gs.boardSize, KOMI) : null);

	function onVertexClick(x, y) {
		if (isSpectator) return;
		if (gs.status === 'playing') {
			if (!isMyTurn) return;
			const movingSign = isLocal ? gs.currentSign : mySign;
			const movingColor = colorName(movingSign);
			const analysis = gs.board.analyzeMove(movingSign, [x, y]);
			if (analysis.overwrite || analysis.suicide || analysis.ko) return;
			const ok = gs.applyMove(x, y, movingSign);
			if (ok)
				gameSocket.send(
					isLocal ? { type: 'move', x, y, color: movingColor } : { type: 'move', x, y }
				);
		} else if (gs.status === 'scoring') {
			gs.deadStones = toggleDeadStones(gs.board, gs.deadStones, x, y);
			gs.blackApproved = false;
			gs.whiteApproved = false;
			gameSocket.send({ type: 'mark_dead', stones: gs.deadStones });
		}
	}

	function pass() {
		if (!isMyTurn) return;
		const movingColor = isLocal ? colorName(gs.currentSign) : myColor;
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

	function resolvePlayerName(targetColor) {
		if (isLocal) return targetColor === 'black' ? 'Black' : 'White';
		if (isSpectator) {
			const name = targetColor === 'black' ? data.game.blackName : data.game.whiteName;
			return name ?? (targetColor === 'black' ? 'Black' : 'White');
		}
		if (targetColor === myColor) return displayName;
		return gameSocket.opponent ?? data.game[targetColor + 'Name'] ?? '...';
	}

	function resolveStripName(targetColor) {
		if (isLocal) {
			const name = targetColor === 'black' ? data.game.blackName : data.game.whiteName;
			return name ?? (targetColor === 'black' ? 'Black' : 'White');
		}
		if (isSpectator) {
			const name = targetColor === 'black' ? data.game.blackName : data.game.whiteName;
			return name ?? (targetColor === 'black' ? 'Black' : 'White');
		}
		if (targetColor === myColor) return displayName;
		return (
			gameSocket.opponent ??
			data.game[targetColor + 'Name'] ??
			(gs.status === 'waiting' ? 'Waiting...' : targetColor)
		);
	}

	const topStripColor = $derived(isSpectator ? 'black' : oppColor);
	const bottomStripColor = $derived(isSpectator ? 'white' : myColor);

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
			if (gs.mySign === null) {
				if (data.game.blackName === displayName) gs.mySign = 1;
				else if (data.game.whiteName === displayName) gs.mySign = -1;
			}
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
						{resolvePlayerName('black')}
					</div>
					<div class="player color-icon is white text">
						{resolvePlayerName('white')}
					</div>
				</div>
			</section>
			{#if gs.status === 'gameover'}
				<section class="status">
					{#if isLocal || isSpectator}
						{gs.winner === 1 ? 'Black' : 'White'} wins{gs.winnerResult
							? ` — ${gs.winnerResult}`
							: ''}.
					{:else if gs.winnerResult}
						{gs.winnerResult} &mdash; {gs.winner === mySign ? 'You win!' : 'You lose.'}
					{:else}
						{gs.winner === mySign ? 'You win!' : 'You lose.'}
					{/if}
				</section>
			{/if}
			{#if gs.status === 'abandoned'}
				<section class="status">{isSpectator ? 'A player left.' : 'Opponent left.'}</section>
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
				onVertexClick={!gs.isViewingHistory && (gs.status === 'playing' || gs.status === 'scoring')
					? onVertexClick
					: null}
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

		<PlayerStrip
			color={topStripColor}
			name={resolveStripName(topStripColor)}
			captures={opponentCaptures}
			position="top"
		/>

		<div class="rmoves">
			{#if gs.isViewingHistory}
				<div class="history-indicator">
					Move {gs.currentViewPly} of {gs.totalPly}
				</div>
			{/if}
			{#if gs.status === 'waiting'}
				<div class="message" data-icon={ICON_INFO}>
					<div>
						{#if isLocal}
							<strong>{gs.currentSign === 1 ? 'Black' : 'White'}</strong> to move<br />
						{:else if isSpectator}
							Waiting for players...
						{:else}
							You are <strong>{myColor}</strong><br />
							Share this link to invite a friend.
						{/if}
					</div>
				</div>
			{:else if gs.status === 'playing'}
				<div class="message" data-icon={ICON_INFO}>
					<div>
						{#if isLocal}
							<strong>{gs.currentSign === 1 ? 'Black' : 'White'}</strong>'s turn
						{:else if isSpectator}
							Spectating<br />{gs.currentSign === 1 ? 'Black' : 'White'} to play
						{:else if isMyTurn}
							You play the {myColor} stones<br /><strong>It's your turn!</strong>
						{:else}
							Waiting for opponent...
						{/if}
						{#if isCorrGame && gs.corrState?.turnDeadline}
							<br /><span class="corr-deadline"
								>{formatCorrDeadline(gs.corrState.turnDeadline)}</span
							>
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
				<ScoreBreakdown
					{score}
					komi={KOMI}
					blackApproved={gs.blackApproved}
					whiteApproved={gs.whiteApproved}
					showApprovals={true}
				/>
			{:else if gs.status === 'gameover'}
				<div class="message" data-icon={ICON_INFO}>
					<div>
						{#if isLocal || isSpectator}
							{gs.winner === 1 ? 'Black' : 'White'} wins
						{:else}
							{gs.winner === mySign ? 'You win' : 'You lose'}
						{/if}
						{#if gs.winnerResult}
							<br />{gs.winnerResult}
						{:else if gs.finalScore}
							<br />{gs.finalScore.blackScore.toFixed(1)} &ndash; {gs.finalScore.whiteScore.toFixed(
								1
							)}
						{:else}
							<br />by resignation
						{/if}
					</div>
				</div>
			{:else if gs.status === 'abandoned'}
				<div class="message" data-icon={ICON_INFO}>
					<div>
						{isSpectator ? 'A player has left the game.' : 'Your opponent has left the game.'}
					</div>
				</div>
			{:else if gs.status === 'aborted'}
				<div class="message" data-icon={ICON_INFO}>
					<div>This game was aborted.</div>
				</div>
			{/if}
		</div>

		<div class="rcontrols">
			{#if gs.status === 'gameover' || gs.status === 'abandoned' || gs.status === 'aborted'}
				<a
					class="button button-metal analyze-btn"
					href="/analysis?game={gameId}"
					data-icon="&#xe01f;">Analyze</a
				>
			{/if}
			{#if !isSpectator && gs.status === 'waiting'}
				<button class="button button-red" onclick={abort}>Abort</button>
			{:else if !isSpectator && gs.status === 'playing'}
				<button class="button button-metal" onclick={pass} disabled={!isMyTurn}>Pass</button>
				<button class="button button-red" onclick={resign}>Resign</button>
			{:else if !isSpectator && gs.status === 'scoring'}
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
			<NavigationButtons
				canPrev={gs.currentViewPly > 0}
				canNext={gs.currentViewPly < gs.totalPly}
				onFirst={() => gs.jumpFirst()}
				onPrev={() => gs.jumpPrev()}
				onNext={() => gs.jumpNext()}
				onLast={() => gs.jumpLast()}
			/>
		{/if}

		<PlayerStrip
			color={bottomStripColor}
			name={resolveStripName(bottomStripColor)}
			captures={myCaptures}
			position="bottom"
		/>

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

	.analyze-btn {
		display: flex;
		align-items: center;
		gap: 0.5em;
		text-decoration: none;
	}

	.analyze-btn::before {
		font-size: 1.2em;
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
