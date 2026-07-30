<script>
  import { tick } from 'svelte';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { getMe } from '$lib/state/user.svelte.js';
  import GoBoard from '$lib/game/GoBoard.svelte';
  import NavigationButtons from '$lib/game/NavigationButtons.svelte';
  import { emptyMarkerMap, formatVertex } from '$lib/game/board/helpers.js';
  import { createBoard, applySetup, applyMove } from '$lib/game/board/board.js';
  import { Board as CameraBoard, toSignMap } from '$lib/reconstruct/gobanIRL.js';
  import {
    sortCorners,
    warpPerspective,
    transformFull,
    computeH,
    intersectionPoint
  } from '$lib/reconstruct/graphicsUtils.js';
  import { getFrames } from '$lib/snapshot-record/db.js';
  import {
    decodeFrameImageData,
    diffVertices,
    stonesFromSignMap,
    calibrateFromSignMap,
    classifyRawValues
  } from '$lib/reconstruct/reconstructUtils.js';

  const BOARD_SIZE = 19;
  const CALIBRATION_STORAGE_KEY = 'reconstruct-corners-v1';
  const sessionId = page.params.sessionId ?? null;

  function loadSavedCalibration() {
    try {
      const parsed = JSON.parse(localStorage.getItem(CALIBRATION_STORAGE_KEY));
      if (parsed?.corners?.length === 4 && parsed?.gridCorners?.length === 4) return parsed;
    } catch {
      // no saved calibration, or it's corrupted - fall through to manual entry
    }
    return null;
  }

  function saveCalibration() {
    localStorage.setItem(CALIBRATION_STORAGE_KEY, JSON.stringify({ corners, gridCorners }));
  }

  let phase = $state('loading');
  let loadError = $state(null);
  let frames = $state([]);
  let frame0ImageData = $state(null);

  let corners = $state([]);
  let draggingCorner = -1;
  let cornersCanvas;

  let gridCorners = $state([]);
  let draggingGridCorner = -1;
  let calibCanvas;
  let rectifiedImageData = null;

  let correctedImageData = null;
  let correctedCorners = null;
  let setupSignMap = $state(null);
  let setupHints = $state([]);
  let calibration = $state(null);
  let calibrationError = $state(null);
  let referenceCanvas;

  let initialStones = [];
  let startingSign = $state(1);
  let nextSign = $state(1);
  let confirmedBoard = $state(null);
  let moveList = $state([]);
  let moveError = $state(null);

  let workingFrameIndex = $state(1);
  let detectedSignMap = $state(null);
  let hintVertices = $state([]);
  let currentRawValues = null;
  let markedEmptyKeys = $state(new Set());
  let markingMode = $state(false);
  let showDebug = $state(false);
  let suggestionsEnabled = $state(true);
  let activeTab = $state('board');

  const markerMap = $derived.by(() => {
    const map = emptyMarkerMap(BOARD_SIZE);
    for (const move of moveList) map[move.y][move.x] = { type: 'number', label: move.moveNumber };
    for (const { x, y, sign } of hintVertices) {
      if (!map[y][x]) map[y][x] = { type: 'hint', sign };
    }
    for (const key of markedEmptyKeys) {
      const [y, x] = key.split(',').map(Number);
      if (!map[y][x]) map[y][x] = 'square';
    }
    return map;
  });

  const setupMarkerMap = $derived.by(() => {
    const map = emptyMarkerMap(BOARD_SIZE);
    for (const { x, y, sign } of setupHints) {
      if (setupSignMap[y][x] === 0) map[y][x] = { type: 'hint', sign };
    }
    return map;
  });

  const proposedMoves = $derived.by(() => {
    if (!confirmedBoard || !suggestionsEnabled) return [];
    const candidates = hintVertices.filter(
      ({ x, y, sign }) => sign !== 0 && confirmedBoard.signMap[y][x] === 0
    );
    const remaining = [...candidates];
    const sequence = [];
    let sign = nextSign;
    let next = remaining.findIndex((c) => c.sign === sign);
    while (next !== -1) {
      sequence.push(remaining[next]);
      remaining.splice(next, 1);
      sign = sign === 1 ? -1 : 1;
      next = remaining.findIndex((c) => c.sign === sign);
    }
    return sequence;
  });

  function countSigns(signMap) {
    if (!signMap) return null;
    const flat = signMap.flat();
    return {
      black: flat.filter((v) => v === 1).length,
      empty: flat.filter((v) => v === 0).length,
      white: flat.filter((v) => v === -1).length
    };
  }

  const confirmedCounts = $derived(countSigns(confirmedBoard?.signMap ?? null));
  const detectedCounts = $derived(countSigns(detectedSignMap));

  const frameMenuItems = $derived([
    {
      label: suggestionsEnabled ? 'Disable suggestions' : 'Enable suggestions',
      onclick: () => {
        suggestionsEnabled = !suggestionsEnabled;
        goToFrame(workingFrameIndex);
      }
    },
    {
      label: showDebug ? 'Hide detection details' : 'Show detection details',
      onclick: () => (showDebug = !showDebug)
    },
    { label: 'Recalibrate corners', onclick: resetCalibration }
  ]);

  async function init() {
    if (!sessionId) {
      loadError = 'No session selected.';
      return;
    }
    const stored = await getFrames(sessionId);
    if (stored.length < 2) {
      loadError = 'This session needs at least two frames to reconstruct.';
      return;
    }
    frames = stored.map((frame) => ({ ...frame, url: URL.createObjectURL(frame.blob) }));
    frame0ImageData = await decodeFrameImageData(frames[0].blob);

    const saved = loadSavedCalibration();
    if (saved) {
      corners = saved.corners;
      gridCorners = saved.gridCorners;
      rectifiedImageData = warpPerspective(frame0ImageData, sortCorners(corners));
      await confirmGrid();
      return;
    }

    phase = 'corners';
    await tick();
    drawCorners();
  }
  init();

  function resetCalibration() {
    // a new grid mapping invalidates every vertex coordinate computed under the old one -
    // moves, marks, and the confirmed board all have to start over along with the corners
    localStorage.removeItem(CALIBRATION_STORAGE_KEY);
    corners = [];
    gridCorners = [];
    rectifiedImageData = null;
    correctedImageData = null;
    correctedCorners = null;
    setupSignMap = null;
    setupHints = [];
    calibration = null;
    calibrationError = null;
    initialStones = [];
    startingSign = 1;
    nextSign = 1;
    confirmedBoard = null;
    moveList = [];
    moveError = null;
    workingFrameIndex = 1;
    detectedSignMap = null;
    hintVertices = [];
    currentRawValues = null;
    markedEmptyKeys = new Set();
    markingMode = false;
    phase = 'corners';
    tick().then(drawCorners);
  }

  function drawReference(imageData) {
    if (!referenceCanvas || !imageData) return;
    referenceCanvas.width = imageData.width;
    referenceCanvas.height = imageData.height;
    referenceCanvas.getContext('2d').putImageData(imageData, 0, 0);
  }

  // ---- corners phase ----

  function eventToImageCoords(e, canvas, imageWidth, imageHeight) {
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) * imageWidth) / rect.width;
    const y = ((e.clientY - rect.top) * imageHeight) / rect.height;
    return { x, y };
  }

  function drawCorners() {
    if (!cornersCanvas || !frame0ImageData) return;
    cornersCanvas.width = frame0ImageData.width;
    cornersCanvas.height = frame0ImageData.height;
    const ctx = cornersCanvas.getContext('2d');
    ctx.putImageData(frame0ImageData, 0, 0);

    const dotRadius = frame0ImageData.width / 60;
    if (corners.length >= 2) {
      const outline = corners.length === 4 ? sortCorners(corners) : corners;
      const path =
        corners.length === 4 ? [outline[0], outline[1], outline[3], outline[2]] : outline;
      ctx.beginPath();
      ctx.moveTo(path[0].x, path[0].y);
      for (const c of path.slice(1)) ctx.lineTo(c.x, c.y);
      if (corners.length === 4) ctx.closePath();
      ctx.strokeStyle = 'rgba(255,80,80,0.7)';
      ctx.lineWidth = dotRadius * 0.3;
      ctx.stroke();
    }
    for (const [index, corner] of corners.entries()) {
      ctx.beginPath();
      ctx.arc(corner.x, corner.y, dotRadius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,80,80,0.85)';
      ctx.fill();
      ctx.fillStyle = 'white';
      ctx.font = `bold ${dotRadius * 1.1}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(index + 1, corner.x, corner.y);
    }
  }

  function cornersPointerDown(e) {
    const { x, y } = eventToImageCoords(
      e,
      cornersCanvas,
      frame0ImageData.width,
      frame0ImageData.height
    );
    const hitRadius = frame0ImageData.width / 40;
    const hitIndex = corners.findIndex((c) => Math.hypot(c.x - x, c.y - y) < hitRadius);
    if (hitIndex >= 0) {
      draggingCorner = hitIndex;
      cornersCanvas.setPointerCapture(e.pointerId);
      return;
    }
    if (corners.length >= 4) return;
    corners = [...corners, { x, y }];
    drawCorners();
  }

  function cornersPointerMove(e) {
    if (draggingCorner < 0) return;
    const { x, y } = eventToImageCoords(
      e,
      cornersCanvas,
      frame0ImageData.width,
      frame0ImageData.height
    );
    corners = corners.map((c, i) => (i === draggingCorner ? { x, y } : c));
    drawCorners();
  }

  function cornersPointerUp() {
    draggingCorner = -1;
  }

  function undoCorner() {
    corners = corners.slice(0, -1);
    drawCorners();
  }

  async function proceedToGrid() {
    rectifiedImageData = warpPerspective(frame0ImageData, sortCorners(corners));
    phase = 'grid';
    await tick();
    drawGrid();
  }

  // ---- grid phase ----

  function eventToGridCoords(e) {
    const rect = calibCanvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) * rectifiedImageData.width) / rect.width;
    const y = ((e.clientY - rect.top) * rectifiedImageData.height) / rect.height;
    return { x, y };
  }

  function drawGrid() {
    if (!calibCanvas || !rectifiedImageData) return;
    calibCanvas.width = rectifiedImageData.width;
    calibCanvas.height = rectifiedImageData.height;
    const ctx = calibCanvas.getContext('2d');
    ctx.putImageData(rectifiedImageData, 0, 0);

    for (const corner of gridCorners) {
      ctx.beginPath();
      ctx.arc(corner.x, corner.y, 14, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,80,80,0.85)';
      ctx.fill();
    }
    if (gridCorners.length < 4) return;

    const H = computeH(sortCorners(gridCorners));
    ctx.strokeStyle = 'rgba(255,80,80,0.7)';
    ctx.lineWidth = 1.5;
    for (let row = 0; row < BOARD_SIZE; row++) {
      ctx.beginPath();
      const start = intersectionPoint(H, row, 0);
      ctx.moveTo(start.x, start.y);
      for (let col = 1; col < BOARD_SIZE; col++) {
        const pt = intersectionPoint(H, row, col);
        ctx.lineTo(pt.x, pt.y);
      }
      ctx.stroke();
    }
    for (let col = 0; col < BOARD_SIZE; col++) {
      ctx.beginPath();
      const start = intersectionPoint(H, 0, col);
      ctx.moveTo(start.x, start.y);
      for (let row = 1; row < BOARD_SIZE; row++) {
        const pt = intersectionPoint(H, row, col);
        ctx.lineTo(pt.x, pt.y);
      }
      ctx.stroke();
    }
  }

  function gridPointerDown(e) {
    const { x, y } = eventToGridCoords(e);
    const hitRadius = rectifiedImageData.width / 12;
    const hitIndex = gridCorners.findIndex((c) => Math.hypot(c.x - x, c.y - y) < hitRadius);
    if (hitIndex >= 0) {
      draggingGridCorner = hitIndex;
      calibCanvas.setPointerCapture(e.pointerId);
      return;
    }
    if (gridCorners.length < 4) {
      gridCorners = [...gridCorners, { x, y }];
      drawGrid();
    }
  }

  function gridPointerMove(e) {
    if (draggingGridCorner < 0) return;
    const { x, y } = eventToGridCoords(e);
    gridCorners = gridCorners.map((c, i) => (i === draggingGridCorner ? { x, y } : c));
    drawGrid();
  }

  function gridPointerUp() {
    draggingGridCorner = -1;
  }

  function undoGridCorner() {
    gridCorners = gridCorners.slice(0, -1);
    drawGrid();
  }

  async function confirmGrid() {
    saveCalibration();
    const result = transformFull(rectifiedImageData, gridCorners);
    correctedImageData = result.imageData;
    correctedCorners = result.corners;
    setupSignMap = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0));
    const rawDetection = new CameraBoard(correctedImageData, correctedCorners);
    setupHints = diffVertices(setupSignMap, toSignMap(rawDetection.state));
    phase = 'setup';
    await tick();
    drawReference(correctedImageData);
  }

  // ---- setup phase ----

  function cycleSetupVertex(x, y) {
    const current = setupSignMap[y][x];
    const next = current === 0 ? 1 : current === 1 ? -1 : 0;
    setupSignMap = setupSignMap.map((row, ry) =>
      ry === y ? row.map((v, rx) => (rx === x ? next : v)) : row
    );
  }

  async function confirmSetup() {
    try {
      const geometryBoard = new CameraBoard(correctedImageData, correctedCorners);
      calibration = calibrateFromSignMap(geometryBoard, setupSignMap);
    } catch {
      calibration = null;
    }
    initialStones = stonesFromSignMap(setupSignMap);
    let board = createBoard(BOARD_SIZE);
    board = applySetup(board, initialStones);
    confirmedBoard = board;
    nextSign = startingSign;
    phase = 'frames';
    await goToFrame(1);
  }

  // ---- frames phase ----

  async function goToFrame(index) {
    if (index < 1) return;
    if (index >= frames.length) {
      phase = 'done';
      return;
    }
    workingFrameIndex = index;
    moveError = null;
    await tick();

    const imageData = await decodeFrameImageData(frames[index].blob);
    const rectified = warpPerspective(imageData, sortCorners(corners));
    const corrected = transformFull(rectified, gridCorners);
    drawReference(corrected.imageData);

    if (!suggestionsEnabled) {
      currentRawValues = null;
      detectedSignMap = null;
      hintVertices = [];
      return;
    }

    try {
      const geometryBoard = new CameraBoard(corrected.imageData, corrected.corners);
      calibration = calibrateFromSignMap(geometryBoard, confirmedBoard.signMap);
      calibrationError = null;
    } catch (err) {
      // not enough confirmed black/white/empty examples yet (or this frame is too noisy) -
      // keep the previous calibration rather than falling back to an uncalibrated guess
      calibrationError = err.message;
    }

    if (calibration) {
      const detectionBoard = new CameraBoard(corrected.imageData, corrected.corners, calibration);
      currentRawValues = detectionBoard.getValues(calibration.detectionFunction);
      detectedSignMap = classifyRawValues(currentRawValues, calibration.cutoffs, markedEmptyKeys);
      hintVertices = diffVertices(confirmedBoard.signMap, detectedSignMap);
    } else {
      currentRawValues = null;
      detectedSignMap = null;
      hintVertices = [];
    }
  }

  function toggleMarkedEmpty(x, y) {
    const key = `${y},${x}`;
    const next = new Set(markedEmptyKeys);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    markedEmptyKeys = next;
    if (calibration && currentRawValues) {
      detectedSignMap = classifyRawValues(currentRawValues, calibration.cutoffs, markedEmptyKeys);
      hintVertices = diffVertices(confirmedBoard.signMap, detectedSignMap);
    }
  }

  function previousFrame() {
    goToFrame(workingFrameIndex - 1);
  }

  function recomputeHints() {
    if (!detectedSignMap) return;
    hintVertices = diffVertices(confirmedBoard.signMap, detectedSignMap);
  }

  function attemptMove(x, y) {
    try {
      const newBoard = applyMove(confirmedBoard, nextSign, x, y);
      confirmedBoard = newBoard;
      moveList = [
        ...moveList,
        { x, y, sign: nextSign, moveNumber: moveList.length + 1, frameIndex: workingFrameIndex }
      ];
      nextSign = nextSign === 1 ? -1 : 1;
      moveError = null;
      recomputeHints();
    } catch {
      moveError = 'Illegal move there.';
    }
  }

  function acceptProposedMoves() {
    for (const { x, y } of proposedMoves) attemptMove(x, y);
  }

  function acceptProposedAndNext() {
    acceptProposedMoves();
    nextFrame();
  }

  function undoLastMove() {
    if (moveList.length === 0) return;
    moveList = moveList.slice(0, -1);
    let board = createBoard(BOARD_SIZE);
    board = applySetup(board, initialStones);
    for (const move of moveList) board = applyMove(board, move.sign, move.x, move.y);
    confirmedBoard = board;
    nextSign = moveList.length % 2 === 0 ? startingSign : startingSign === 1 ? -1 : 1;
    moveError = null;
    recomputeHints();
  }

  function toggleNextSign() {
    nextSign = nextSign === 1 ? -1 : 1;
  }

  function nextFrame() {
    goToFrame(workingFrameIndex + 1);
  }

  // ---- done phase ----

  let isSaving = $state(false);
  let saveError = $state(null);
  const initialWhiteStoneCount = $derived(initialStones.filter((s) => s.sign === -1).length);

  async function saveGame() {
    isSaving = true;
    saveError = null;
    try {
      const dbMoves = moveList.map((move) => ({ type: 'move', x: move.x, y: move.y }));
      const handicapStones = initialStones
        .filter((stone) => stone.sign === 1)
        .map(({ x, y }) => ({ x, y }));
      const res = await fetch('/api/game/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          moves: dbMoves,
          handicapStones,
          blackName: '',
          whiteName: '',
          size: BOARD_SIZE,
          komi: 6.5,
          username: getMe()?.username ?? null
        })
      });
      const { id } = await res.json();
      await goto(`/kifu/${id}`);
    } catch {
      saveError = 'Could not save this game.';
    } finally {
      isSaving = false;
    }
  }
</script>

{#snippet viewTabs()}
  <div class="reconstruct__tabs tabs-horiz">
    <button class:active={activeTab === 'board'} onclick={() => (activeTab = 'board')}>
      Board
    </button>
    <button class:active={activeTab === 'photo'} onclick={() => (activeTab = 'photo')}>
      Photo
    </button>
  </div>
{/snippet}

<div class="reconstruct">
  {#if loadError}
    <p class="reconstruct__error">{loadError}</p>
  {:else if phase === 'loading'}
    <p class="reconstruct__instruction">Loading session…</p>
  {:else if phase === 'corners'}
    <p class="reconstruct__instruction">Tap the 4 corners of the board ({corners.length}/4)</p>
    <canvas
      class="reconstruct__canvas"
      bind:this={cornersCanvas}
      onpointerdown={cornersPointerDown}
      onpointermove={cornersPointerMove}
      onpointerup={cornersPointerUp}
    ></canvas>
    <div class="reconstruct__controls">
      <button class="button button-empty" onclick={undoCorner} disabled={corners.length === 0}>
        Undo
      </button>
      <button class="button" onclick={proceedToGrid} disabled={corners.length < 4}>Next</button>
    </div>
  {:else if phase === 'grid'}
    <p class="reconstruct__instruction">Tap the corners of the grid ({gridCorners.length}/4)</p>
    <canvas
      class="reconstruct__canvas"
      bind:this={calibCanvas}
      onpointerdown={gridPointerDown}
      onpointermove={gridPointerMove}
      onpointerup={gridPointerUp}
    ></canvas>
    <div class="reconstruct__controls">
      <button
        class="button button-empty"
        onclick={undoGridCorner}
        disabled={gridCorners.length === 0}
      >
        Undo
      </button>
      <button class="button" onclick={confirmGrid} disabled={gridCorners.length < 4}>Next</button>
    </div>
  {:else if phase === 'setup'}
    <div class="reconstruct__phase">
      <div class="reconstruct__main">
        <p class="reconstruct__instruction">
          Tap to place stones matching the photo. Rings are a guess, not fact.
        </p>
        {@render viewTabs()}
        <div class="reconstruct__layout">
          <div class="reconstruct__board" class:reconstruct__panel--hidden={activeTab !== 'board'}>
            <GoBoard
              signMap={setupSignMap}
              markerMap={setupMarkerMap}
              size={BOARD_SIZE}
              onVertexClick={cycleSetupVertex}
              useTheme={false}
            />
          </div>
          <canvas
            class="reconstruct__reference"
            class:reconstruct__panel--hidden={activeTab !== 'photo'}
            bind:this={referenceCanvas}
          ></canvas>
        </div>
      </div>
      <div class="reconstruct__sidebar">
        <button class="button" onclick={confirmSetup}>Confirm position</button>
        <label class="reconstruct__sign-toggle">
          <input
            type="checkbox"
            checked={startingSign === -1}
            onchange={() => (startingSign = startingSign === 1 ? -1 : 1)}
          />
          White moves first
        </label>
        <button class="button button-empty" onclick={resetCalibration}>Recalibrate corners</button>
      </div>
    </div>
  {:else if phase === 'frames'}
    <div class="reconstruct__phase">
      <div class="reconstruct__main">
        <p class="reconstruct__instruction">Frame {workingFrameIndex + 1} of {frames.length}</p>
        {#if markingMode}
          <p class="reconstruct__hint-note">Tap spots to mark/unmark as unreliable.</p>
        {:else if !suggestionsEnabled}
          <p class="reconstruct__hint-note">Suggestions disabled.</p>
        {:else if calibration}
          <p class="reconstruct__hint-note">Tap a ring to place that stone.</p>
        {:else}
          <p class="reconstruct__hint-note">No suggestions yet &mdash; add a few moves manually.</p>
        {/if}
        {@render viewTabs()}
        <div class="reconstruct__layout">
          <div class="reconstruct__board" class:reconstruct__panel--hidden={activeTab !== 'board'}>
            <GoBoard
              signMap={confirmedBoard.signMap}
              {markerMap}
              currentSign={nextSign}
              size={BOARD_SIZE}
              onVertexClick={markingMode ? toggleMarkedEmpty : attemptMove}
              useTheme={false}
            />
          </div>
          <canvas
            class="reconstruct__reference"
            class:reconstruct__panel--hidden={activeTab !== 'photo'}
            bind:this={referenceCanvas}
          ></canvas>
        </div>
        <button class="button reconstruct__accept-btn" onclick={acceptProposedAndNext}>
          {proposedMoves.length > 0 ? `Accept ${proposedMoves.length} & next frame` : 'Next frame'}
        </button>
        <NavigationButtons
          canPrev={workingFrameIndex > 1}
          canNext={workingFrameIndex < frames.length - 1}
          onFirst={() => goToFrame(1)}
          onPrev={previousFrame}
          onNext={nextFrame}
          onLast={() => goToFrame(frames.length - 1)}
          menuItems={frameMenuItems}
        />
        {#if moveError}
          <p class="reconstruct__error">{moveError}</p>
        {/if}
        {#if proposedMoves.length > 0}
          <p class="reconstruct__proposed">
            Proposed order:
            {#each proposedMoves as move, i}
              {i > 0 ? ',' : ''}
              {move.sign === 1 ? '●' : '○'}
              {formatVertex([move.x, move.y], BOARD_SIZE)}
            {/each}
          </p>
        {/if}
        {#if showDebug}
          <div class="reconstruct__debug">
            <span>frame {workingFrameIndex} &middot; suggestions enabled: {suggestionsEnabled}</span
            >
            <span>calibration: {calibration ? calibration.detectionFunction.name : 'none'}</span>
            {#if calibrationError}
              <span>calibration error: {calibrationError}</span>
            {/if}
            {#if calibration}
              <span
                >cutoffs: black {Math.round(calibration.cutoffs.black)} &middot; white {Math.round(
                  calibration.cutoffs.white
                )}</span
              >
            {/if}
            <span>
              confirmed board: ● {confirmedCounts.black} &middot; empty {confirmedCounts.empty}
              &middot; ○ {confirmedCounts.white}
            </span>
            <span>
              detected this frame: {detectedCounts
                ? `● ${detectedCounts.black} · empty ${detectedCounts.empty} · ○ ${detectedCounts.white}`
                : 'not computed'}
            </span>
            <span
              >hints: {hintVertices.length}
              {hintVertices.length
                ? `(${hintVertices.map((h) => `${h.x},${h.y}`).join(' ')})`
                : ''}</span
            >
            <span
              >marked empty: {markedEmptyKeys.size}
              {markedEmptyKeys.size ? `(${[...markedEmptyKeys].join(' ')})` : ''}</span
            >
            <span>moves confirmed: {moveList.length}</span>
          </div>
        {/if}
      </div>
      <div class="reconstruct__sidebar">
        <button class="button button-empty" onclick={undoLastMove} disabled={moveList.length === 0}>
          Undo last move
        </button>
        <button
          class="button button-empty"
          class:reconstruct__marking-active={markingMode}
          onclick={() => (markingMode = !markingMode)}
        >
          {markingMode ? 'Cancel marking' : 'Mark spot as empty'} ({markedEmptyKeys.size})
        </button>
        <button class="button button-empty" onclick={toggleNextSign}>Swap next color</button>
      </div>
    </div>
  {:else if phase === 'done'}
    <p class="reconstruct__instruction">
      All frames processed &middot; {moveList.length} moves recorded.
    </p>
    <div class="reconstruct__board">
      <GoBoard
        signMap={confirmedBoard.signMap}
        {markerMap}
        size={BOARD_SIZE}
        interactive={false}
        useTheme={false}
      />
    </div>
    {#if initialWhiteStoneCount > 0}
      <p class="reconstruct__hint-note">
        Note: {initialWhiteStoneCount} white stone{initialWhiteStoneCount === 1 ? '' : 's'} in the starting
        position can't be represented as a handicap and will be dropped from the saved game.
      </p>
    {/if}
    {#if saveError}
      <p class="reconstruct__error">{saveError}</p>
    {/if}
    <div class="reconstruct__controls">
      <button class="button" onclick={saveGame} disabled={isSaving}>
        {isSaving ? 'Saving…' : 'Save game'}
      </button>
    </div>
  {/if}
</div>

<style>
  .reconstruct {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1rem;
    max-width: 1280px;
    margin: 0 auto;
  }

  .reconstruct__instruction {
    margin: 0;
    text-align: center;
  }

  .reconstruct__error {
    color: var(--c-bad);
    text-align: center;
    margin: 0;
  }

  .reconstruct__hint-note {
    margin: 0;
    text-align: center;
    font-size: 0.85rem;
    opacity: 0.7;
  }

  .reconstruct__canvas {
    width: 100%;
    max-width: 500px;
    align-self: center;
    cursor: crosshair;
    touch-action: none;
    border-radius: 7px;
    box-shadow:
      0 2px 2px 0 rgba(0, 0, 0, 0.14),
      0 3px 1px -2px rgba(0, 0, 0, 0.2),
      0 1px 5px 0 rgba(0, 0, 0, 0.12);
  }

  .reconstruct__tabs {
    display: flex;
  }

  @media (min-width: 750px) {
    .reconstruct__tabs {
      display: none;
    }
  }

  .reconstruct__phase {
    display: grid;
    grid-template-areas: 'main' 'sidebar';
    gap: 1rem;
  }

  @media (min-width: 750px) {
    .reconstruct__phase {
      grid-template-areas: 'main sidebar';
      grid-template-columns: minmax(0, 1fr) 220px;
      align-items: start;
    }
  }

  .reconstruct__main {
    grid-area: main;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    min-width: 0;
  }

  .reconstruct__sidebar {
    grid-area: sidebar;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .reconstruct__sidebar .button {
    width: 100%;
  }

  .reconstruct__layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 1rem;
  }

  @media (min-width: 750px) {
    .reconstruct__layout {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      align-items: start;
    }
  }

  @media (max-width: 749px) {
    .reconstruct__board.reconstruct__panel--hidden,
    .reconstruct__reference.reconstruct__panel--hidden {
      display: none;
    }
  }

  .reconstruct__board {
    aspect-ratio: 1;
    min-width: 0;
  }

  .reconstruct__reference {
    width: 100%;
    aspect-ratio: 1;
    object-fit: fill;
    border-radius: 7px;
    display: block;
    box-shadow:
      0 2px 2px 0 rgba(0, 0, 0, 0.14),
      0 3px 1px -2px rgba(0, 0, 0, 0.2),
      0 1px 5px 0 rgba(0, 0, 0, 0.12);
  }

  .reconstruct__controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }

  .reconstruct__marking-active {
    outline: 2px solid var(--c-primary);
  }

  .reconstruct__accept-btn {
    width: 100%;
    font-size: 1.05rem;
  }

  .reconstruct__sign-toggle {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .reconstruct__proposed {
    margin: 0;
    font-size: 0.85rem;
    opacity: 0.85;
  }

  .reconstruct__debug {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    margin-top: 0.5rem;
    padding: 0.5rem 0.7rem;
    border-radius: 6px;
    border: 1px solid var(--c-border);
    font-family: monospace;
    font-size: 0.75rem;
    opacity: 0.85;
    word-break: break-word;
  }
</style>
