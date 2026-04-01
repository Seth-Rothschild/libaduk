<!--
  OGS Integration Prototype
  =========================
  This is a preserved copy of the standalone OGS game prototype.
  Not imported anywhere — kept as reference for the OGS WebSocket protocol,
  challenge creation, game flow, scoring, and chat.

  To test: import this component and pass { ogs: { id, username } } as data.

  REFERENCE MATERIAL:
    - OGS REST API schema: ~/Downloads/Online-Go.com API.yaml
    - OGS WS protocol: goban/src/engine/protocol/ClientToServer.ts (what we send)
                        goban/src/engine/protocol/ServerToClient.ts (what we receive)
    - OGS socket impl:  goban/src/engine/GobanSocket.ts (ping, connection lifecycle)
    - OGS game logic:   goban/src/Goban/OGSConnectivity.ts (move, chat, resign, scoring)
    - Plain WS endpoint: wss://wsp.online-go.com/ (no socket.io framing)

  ARCHITECTURE:
    - REST calls go directly to online-go.com with the Bearer token from the ogs_token cookie.
    - WebSocket connects directly from the browser to wss://wsp.online-go.com/.
      OGS allows cross-origin WS connections. Uses plain WebSocket (no socket.io).
    - Auth: OAuth access token stored as ogs_token cookie (for REST proxy).
            JWT fetched from /api/v1/ui/config/ (for WS authenticate).
            These are different tokens — the OAuth token cannot be used for WS auth.

  WS PROTOCOL NOTES (plain WebSocket, no socket.io):
    - Messages are plain JSON arrays: ["command", {data}, optional_request_id]
    - On open: send authenticate with {jwt}. JWT comes from REST /api/v1/ui/config/.
    - Must send net/ping every ~10s with {client, drift, latency} to stay alive.
      Server replies with net/pong containing {client, server} for drift calculation.
    - See goban/src/engine/GobanSocket.ts for the reference implementation.

  CHALLENGE CREATION (REST POST /api/v1/challenges/):
    - game settings go inside a "game" object (not top-level).
    - time_control_parameters must include system, speed, time_control, plus the
      specific fields for that system (main_time/period_time/periods for byoyomi).
    - Response: {status, challenge: <id>, game: <id>, uuid}.
    - The game ID exists immediately but the game itself doesn't start until accepted.
    - Challenges appear under Custom Games on OGS, not in the quick match pools.

  GAME FLOW (WS):
    - game/connect {game_id, chat: true} — subscribes to game events.
    - Server sends game/{id}/gamedata with full state (board, moves, players, clock).
    - game/move {game_id, move: "dd"} — SGF-style coords, "aa"=top-left, ".."=pass.
    - game/resign {game_id} — resign the game.
    - game/chat {game_id, type: "main", move_number, body} — send chat message.
    - Incoming events: game/{id}/move, game/{id}/clock, game/{id}/phase,
      game/{id}/chat, game/{id}/error.
    - notification {type: "gameStarted", game_id} fires when opponent accepts challenge.

  SCORING (WS):
    - Both players pass → phase changes to "stone removal"
    - Server sends game/{id}/removed_stones with {removed, stones, all_removed, score}
    - stones/all_removed are SGF coordinate pairs (e.g. "aabb" = (0,0) and (1,1))
    - Toggle dead stone: game/removed_stones/set {game_id, removed: bool, stones: "ab"}
    - Accept scoring: game/removed_stones/accept {game_id, stones: all_removed}
    - Reject (resume play): game/removed_stones/reject {game_id}
    - score object: {white: {total, stones, territory, prisoners, komi, ...}, black: {...}}

  KNOWN QUIRKS:
    - REST move endpoint (POST /api/v1/games/{id}/move/) returns 500 for all formats
      we tried. Moves must go through WebSocket.
    - REST pass endpoint also 500s. Use WS game/move with move=".." instead.
    - OGS board format uses 0=empty, 1=black, 2=white.
      Our GoBoard uses 0=empty, 1=black, -1=white. See ogsToSignMap().
    - Creating a challenge that immediately gets cancelled may cause subsequent
      challenges to not appear in the OGS lobby (possible anti-spam measure).
    - Plain WS gamedata does NOT include a "board" field — only "moves" and
      "initial_state". Use REST /api/v1/games/{id}/state/ to get the board.
-->

<script>
  import GoBoard from '$lib/game/GoBoard.svelte';
  import GameChat from '$lib/game/GameChat.svelte';

  let { data } = $props();

  // --- State ---

  let log = $state([]);
  let challengeId = $state(null);
  let gameId = $state(null);
  let signMap = $state(null);
  let lastMove = $state(null);
  let currentPlayer = $state(null);
  let myColor = $state(null);
  let phase = $state(null);
  let moveNumber = $state(0);
  let chatMessages = $state([]);
  let gameIdInput = $state('');
  let wsConnected = $state(false);
  let ws = $state(null);
  let wsMessageId = $state(1);
  let ogsJwt = $state(null);
  let wsPingInterval = $state(null);
  let drift = $state(0);
  let latency = $state(0);
  let removedStones = $state('');
  let ogsScore = $state(null);

  let deadStones = $derived(removedStones ? parseSgfCoords(removedStones) : []);

  function addLog(msg) {
    const timestamp = new Date().toLocaleTimeString();
    log = [...log, `[${timestamp}] ${msg}`];
  }

  // --- REST ---

  function getOgsToken() {
    const pairs = document.cookie.split(';');
    for (const pair of pairs) {
      const [key, value] = pair.trim().split('=');
      if (key === 'ogs_token') return decodeURIComponent(value);
    }
    return null;
  }

  async function ogsRequest(method, path, body) {
    try {
      addLog(`${method} ${path}${body ? ' ' + JSON.stringify(body) : ''}`);
      const options = {
        method,
        headers: { Authorization: `Bearer ${getOgsToken()}`, 'Content-Type': 'application/json' }
      };
      if (body && method !== 'GET' && method !== 'DELETE') {
        options.body = JSON.stringify(body);
      }
      const res = await fetch(`https://online-go.com${path}`, options);
      const text = await res.text();
      addLog(`Response ${res.status}: ${text.slice(0, 500)}`);
      return JSON.parse(text);
    } catch (err) {
      addLog(`ERROR: ${err.message}`);
      return null;
    }
  }

  async function ogsGet(path) {
    return ogsRequest('GET', path, null);
  }

  async function ogsPost(path, payload) {
    return ogsRequest('POST', path, payload);
  }

  async function fetchJwt() {
    const result = await ogsGet('/api/v1/ui/config/');
    if (result && result.user_jwt) {
      addLog('Got JWT');
      return result.user_jwt;
    }
    addLog('No JWT found in ui/config');
    return null;
  }

  function ogsToSignMap(ogsBoard) {
    return ogsBoard.map((row) =>
      row.map((cell) => {
        if (cell === 1) return 1;
        if (cell === 2) return -1;
        return 0;
      })
    );
  }

  function parseSgfCoords(sgfString) {
    const coords = [];
    for (let i = 0; i < sgfString.length; i += 2) {
      const x = sgfString.charCodeAt(i) - 97;
      const y = sgfString.charCodeAt(i + 1) - 97;
      coords.push([x, y]);
    }
    return coords;
  }

  function toSgfCoord(x, y) {
    return String.fromCharCode(97 + x) + String.fromCharCode(97 + y);
  }

  // --- WebSocket ---

  function wsSend(command, payload) {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      addLog('WS not connected');
      return;
    }
    const id = wsMessageId++;
    const msg = JSON.stringify([command, payload, id]);
    addLog(`WS SEND: ${command}`);
    ws.send(msg);
  }

  function wsSendQuiet(command, payload) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const id = wsMessageId++;
    ws.send(JSON.stringify([command, payload, id]));
  }

  function startPing() {
    if (wsPingInterval) clearInterval(wsPingInterval);
    wsPingInterval = setInterval(() => {
      wsSendQuiet('net/ping', {
        client: Date.now(),
        drift: drift,
        latency: latency
      });
    }, 10000);
  }

  function stopPing() {
    if (wsPingInterval) {
      clearInterval(wsPingInterval);
      wsPingInterval = null;
    }
  }

  async function connectWebSocket() {
    if (!ogsJwt) {
      addLog('Fetching JWT...');
      ogsJwt = await fetchJwt();
      if (!ogsJwt) {
        addLog('Could not get JWT');
        return;
      }
    }

    addLog('Connecting WebSocket...');
    ws = new WebSocket('wss://wsp.online-go.com/');

    ws.onopen = () => {
      addLog('WS opened, authenticating...');
      wsSend('authenticate', { jwt: ogsJwt });
      wsConnected = true;
      startPing();
    };

    ws.onmessage = (event) => {
      let parsed;
      try {
        parsed = JSON.parse(event.data);
      } catch (e) {
        addLog(`WS unparseable: ${event.data.slice(0, 200)}`);
        return;
      }

      const name = parsed[0];
      const eventData = parsed[1];

      if (typeof name === 'number') {
        addLog(`WS response id=${name}: ${JSON.stringify(eventData).slice(0, 200)}`);
        return;
      }

      handleWsEvent(name, eventData);
    };

    ws.onclose = (event) => {
      addLog(`WS closed: code=${event.code} wasClean=${event.wasClean}`);
      wsConnected = false;
      stopPing();
    };

    ws.onerror = () => {
      addLog('WS error');
    };
  }

  function handleWsEvent(name, eventData) {
    if (name === 'net/pong') {
      const now = Date.now();
      latency = now - eventData.client;
      drift = now - latency / 2 - eventData.server;
      return;
    }

    if (gameId && name === `game/${gameId}/gamedata`) {
      addLog(`Gamedata keys: ${Object.keys(eventData).join(', ')}`);
      addLog(`Gamedata received: phase=${eventData.phase}, has board=${!!eventData.board}`);
      phase = eventData.phase;
      myColor = eventData.players.white.id === data.ogs.id ? 'white' : 'black';

      if (eventData.clock) {
        currentPlayer =
          eventData.clock.current_player === data.ogs.id
            ? myColor
            : myColor === 'white'
              ? 'black'
              : 'white';
      }

      if (eventData.moves && eventData.moves.length > 0) {
        const lm = eventData.moves[eventData.moves.length - 1];
        lastMove = [lm[0], lm[1]];
        moveNumber = eventData.moves.length;
      } else {
        lastMove = null;
        moveNumber = 0;
      }

      addLog(`Playing as ${myColor}, phase=${phase}`);
      fetchBoardState();
      return;
    }

    if (gameId && name === `game/${gameId}/move`) {
      addLog(`Move received: ${JSON.stringify(eventData.move)}`);
      moveNumber = eventData.move_number + 1;
      fetchBoardState();
      return;
    }

    if (gameId && name === `game/${gameId}/clock`) {
      currentPlayer =
        eventData.current_player === data.ogs.id
          ? myColor
          : myColor === 'white'
            ? 'black'
            : 'white';
      return;
    }

    if (gameId && name === `game/${gameId}/phase`) {
      phase = eventData;
      addLog(`Phase changed: ${phase}`);
      if (phase === 'stone removal') {
        fetchBoardState();
      }
      if (phase !== 'stone removal') {
        removedStones = '';
        ogsScore = null;
      }
      return;
    }

    if (gameId && name === `game/${gameId}/removed_stones`) {
      removedStones = eventData.all_removed || '';
      ogsScore = eventData.score || null;
      addLog(
        `Removed stones updated: "${removedStones}" B=${ogsScore?.black?.total} W=${ogsScore?.white?.total}`
      );
      return;
    }

    if (gameId && name === `game/${gameId}/chat`) {
      const line = eventData.line || eventData;
      const sender = line.username || line.from || 'unknown';
      const body = typeof line.body === 'string' ? line.body : JSON.stringify(line.body);
      chatMessages = [...chatMessages, { user: sender, text: body }];
      return;
    }

    if (gameId && name === `game/${gameId}/error`) {
      addLog(`GAME ERROR: ${JSON.stringify(eventData)}`);
      return;
    }

    if (name === 'notification') {
      if (eventData.type === 'gameStarted' && eventData.game_id) {
        addLog(`Game started: ${eventData.game_id}`);
        if (challengeId && (!gameId || gameId === eventData.game_id)) {
          gameId = eventData.game_id;
          connectToGame();
        }
      }
      return;
    }

    if (name === 'active_game') {
      if (eventData.id === gameId) {
        currentPlayer =
          eventData.player_to_move === data.ogs.id
            ? myColor
            : myColor === 'white'
              ? 'black'
              : 'white';
        moveNumber = eventData.move_number;
      }
      return;
    }

    if (name.startsWith('active-bots') || name.startsWith('seekgraph')) return;

    addLog(`WS: ${name} ${JSON.stringify(eventData).slice(0, 300)}`);
  }

  function connectToGame() {
    if (!gameId) {
      addLog('No game ID');
      return;
    }
    addLog(`Connecting to game ${gameId}...`);
    wsSend('game/connect', {
      game_id: gameId,
      chat: true
    });
  }

  async function fetchBoardState() {
    const state = await ogsGet(`/api/v1/games/${gameId}/state/`);
    if (state && state.board) {
      signMap = ogsToSignMap(state.board);
      if (state.last_move && state.last_move.x >= 0) {
        lastMove = [state.last_move.x, state.last_move.y];
      }
      moveNumber = state.move_number;
    }
  }

  function disconnectWebSocket() {
    stopPing();
    if (ws) {
      ws.close();
      ws = null;
      wsConnected = false;
    }
  }

  // --- Game actions ---

  function handleVertexClick(x, y) {
    if (!gameId || !wsConnected) return;

    if (phase === 'stone removal') {
      toggleDeadStone(x, y);
      return;
    }

    if (phase !== 'play') return;
    if (currentPlayer !== myColor) {
      addLog('Not your turn');
      return;
    }

    const move = toSgfCoord(x, y);
    addLog(`Sending move: ${move} (${x},${y})`);

    wsSend('game/move', {
      game_id: gameId,
      move: move
    });
  }

  function wsPass() {
    if (!gameId) return;
    wsSend('game/move', {
      game_id: gameId,
      move: '..'
    });
  }

  function wsResign() {
    if (!gameId) return;
    wsSend('game/resign', {
      game_id: gameId
    });
  }

  function toggleDeadStone(x, y) {
    if (!signMap || signMap[y][x] === 0) return;
    const coord = toSgfCoord(x, y);
    const isCurrentlyRemoved = removedStones.includes(coord);
    wsSend('game/removed_stones/set', {
      game_id: gameId,
      removed: !isCurrentlyRemoved,
      stones: coord
    });
  }

  function acceptScoring() {
    if (!gameId) return;
    wsSend('game/removed_stones/accept', {
      game_id: gameId,
      stones: removedStones
    });
    addLog('Accepted scoring');
  }

  function rejectScoring() {
    if (!gameId) return;
    wsSend('game/removed_stones/reject', {
      game_id: gameId
    });
    addLog('Rejected scoring — returning to play');
  }

  function sendChat(text) {
    if (!gameId || !wsConnected || !text) return;
    wsSend('game/chat', {
      game_id: gameId,
      type: 'main',
      move_number: moveNumber,
      body: text
    });
    chatMessages = [...chatMessages, { user: data.ogs.username, text }];
  }

  // --- Challenge creation ---

  async function createChallenge() {
    const challenge = {
      game: {
        name: 'Friendly Match',
        rules: 'japanese',
        ranked: false,
        width: 9,
        height: 9,
        handicap: 0,
        speed: 'live',
        time_control: 'byoyomi',
        time_control_parameters: {
          system: 'byoyomi',
          time_control: 'byoyomi',
          speed: 'live',
          main_time: 3600,
          period_time: 30,
          periods: 5,
          pause_on_weekends: false
        },
        disable_analysis: false,
        pause_on_weekends: false
      },
      challenger_color: 'white',
      min_ranking: -1000,
      max_ranking: 1000
    };
    const result = await ogsPost('/api/v1/challenges/', challenge);
    if (result && result.challenge) {
      challengeId = result.challenge;
      gameId = result.game;
      addLog(`Challenge created: challenge=${challengeId}, game=${gameId}`);
    }
  }

  async function deleteChallenge() {
    if (!challengeId) return;
    await ogsRequest('DELETE', `/api/v1/challenges/${challengeId}/`, null);
    challengeId = null;
  }

  // Cleanup on component destroy
  $effect(() => {
    return () => {
      stopPing();
      if (ws) ws.close();
    };
  });
</script>

<h2>OGS Game Prototype</h2>

<section class="security-section">
  <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 1rem;">
    <button class="button" onclick={connectWebSocket} disabled={wsConnected}>
      {wsConnected ? 'WS Connected' : 'Connect WS'}
    </button>
    <button class="button" onclick={disconnectWebSocket} disabled={!wsConnected}>
      Disconnect WS
    </button>
  </div>

  <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 1rem;">
    <button class="button" onclick={createChallenge} disabled={!wsConnected}>
      Create Challenge (9x9 live, white)
    </button>
    <button class="button" onclick={deleteChallenge} disabled={!challengeId}>
      Delete Challenge
    </button>
  </div>

  <div style="display: flex; gap: 0.5rem; align-items: center; margin-bottom: 1rem;">
    <input
      type="text"
      bind:value={gameIdInput}
      placeholder="Game ID"
      style="padding: 0.25rem 0.5rem; width: 10rem;"
    />
    <button
      class="button"
      onclick={() => {
        gameId = Number(gameIdInput);
        connectToGame();
      }}
      disabled={!wsConnected}
    >
      Join Game
    </button>
  </div>

  {#if challengeId && !signMap}
    <p>Waiting for opponent to accept challenge {challengeId}...</p>
  {/if}

  {#if signMap}
    <div style="display: flex; gap: 2rem; flex-wrap: wrap;">
      <div>
        <p style="margin-bottom: 0.5rem;">
          {#if phase === 'finished'}
            Game finished
          {:else if phase === 'stone removal'}
            <strong>Stone removal</strong> — Click dead stones to toggle
          {:else if currentPlayer === myColor}
            <strong>Your turn ({myColor})</strong>
          {:else}
            Opponent's turn ({currentPlayer})
          {/if}
          — Move {moveNumber}
        </p>

        <GoBoard
          {signMap}
          size={9}
          vertexSize={36}
          {lastMove}
          showCoords={true}
          currentSign={myColor === 'black' ? 1 : -1}
          interactive={(phase === 'play' && currentPlayer === myColor) || phase === 'stone removal'}
          onVertexClick={handleVertexClick}
          {deadStones}
        />

        {#if phase === 'stone removal' && ogsScore}
          <div style="margin-top: 0.5rem; font-size: 0.9rem;">
            <p>Black: {ogsScore.black.total} — White: {ogsScore.white.total}</p>
          </div>
          <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
            <button class="button" onclick={acceptScoring}>Accept</button>
            <button class="button" onclick={rejectScoring}>Resume Play</button>
          </div>
        {:else}
          <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
            <button class="button" onclick={wsPass} disabled={phase !== 'play'}>Pass</button>
            <button class="button" onclick={wsResign} disabled={phase !== 'play'}>Resign</button>
          </div>
        {/if}
      </div>

      <div style="width: 280px;">
        <GameChat
          username={data.ogs.username}
          gameId={String(gameId)}
          gameStatus={phase === 'play' ? 'playing' : phase === 'finished' ? 'gameover' : 'waiting'}
          messages={chatMessages}
          onSend={sendChat}
        />
      </div>
    </div>
  {/if}
</section>

<section class="security-section">
  <h3>Log</h3>
  <pre
    style="max-height: 300px; overflow: auto; font-size: 0.75rem; background: var(--c-bg-box); padding: 0.5rem; border-radius: 4px; white-space: pre-wrap;">{log.join(
      '\n'
    )}</pre>
</section>
