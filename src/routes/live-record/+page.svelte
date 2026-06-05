<script>
  import { onMount } from 'svelte';
  import GoBoard from '$lib/game/GoBoard.svelte';
  import {
    sortCorners,
    warpPerspective,
    transformFull,
    computeH,
    intersectionPoint,
    computeStoneOffsets
  } from '$lib/live-record/graphicsUtils.js';
  import { Board, toSignMap } from '$lib/live-record/gobanIRL.js';

  const BOARD_SIZE = 19;
  const MARKER_COLOR = 'rgba(255,80,80,0.85)';
  const OUTLINE_COLOR = 'rgba(255,80,80,0.6)';
  const GRID_COLOR = 'rgba(255,80,80,0.7)';
  const GRID_LINE_WIDTH = 1.5;

  let phase = $state('corners');
  let corners = $state([]);
  let gridCorners = $state([]);
  let signMap = $state(Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0)));
  let cameraError = $state(false);
  let minMag = $state(0);
  let maxMag = $state(0);
  let cameraCol = $state(0);
  let cameraRow = $state(18);
  let offsets = $derived(computeStoneOffsets(minMag, maxMag, cameraCol, cameraRow));
  let calibrationData = $state([]);
  let selectedFunctionIndex = $state(0);
  let boardBaseline = $state(null);

  let videoEl;
  let overlayCanvas;
  let calibCanvas = $state(null);
  let captureCanvas;
  let pollInterval;
  let draggingCorner = -1;
  let draggingGridCorner = -1;
  let wakeLock = null;
  let videoWidth = 0;
  let videoHeight = 0;
  let rectifiedImageData = null;
  let correctedImageData = null;
  let correctedCorners = null;

  onMount(async () => {
    captureCanvas = document.createElement('canvas');

    async function acquireWakeLock() {
      try {
        wakeLock = await navigator.wakeLock.request('screen');
      } catch {}
    }
    function onVisibilityChange() {
      if (document.visibilityState === 'visible') acquireWakeLock();
    }
    document.addEventListener('visibilitychange', onVisibilityChange);
    acquireWakeLock();

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          frameRate: { max: 5 },
          width: { ideal: 1280 }
        }
      });
    } catch {
      cameraError = true;
    }

    if (stream) {
      videoEl.srcObject = stream;
      videoEl.addEventListener('loadedmetadata', () => {
        videoWidth = videoEl.videoWidth;
        videoHeight = videoEl.videoHeight;
        captureCanvas.width = videoWidth;
        captureCanvas.height = videoHeight;
        overlayCanvas.width = videoWidth;
        overlayCanvas.height = videoHeight;
      });
      videoEl.play();
    }

    return () => {
      stream?.getTracks().forEach((t) => t.stop());
      clearInterval(pollInterval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      wakeLock?.release();
    };
  });

  // ---- corners phase ----

  function eventToVideoCoords(e, rect = null) {
    const r = rect ?? overlayCanvas.getBoundingClientRect();
    const x = (e.clientX - r.left) * (videoWidth / r.width);
    const y = (e.clientY - r.top) * (videoHeight / r.height);
    return { x, y };
  }

  function overlayPointerDown(e) {
    if (phase !== 'corners') return;
    const { x, y } = eventToVideoCoords(e);
    const hitRadius = videoWidth / 40;
    const hitIndex = corners.findIndex((c) => Math.hypot(c.x - x, c.y - y) < hitRadius);
    if (hitIndex >= 0) {
      draggingCorner = hitIndex;
      overlayCanvas.setPointerCapture(e.pointerId);
      return;
    }
    if (corners.length >= 4) return;
    corners = [...corners, { x, y }];
    drawCornersOverlay();
  }

  function overlayPointerMove(e) {
    if (phase !== 'corners' || draggingCorner < 0) return;
    const { x, y } = eventToVideoCoords(e);
    corners = corners.map((c, i) => (i === draggingCorner ? { x, y } : c));
    drawCornersOverlay();
  }

  function overlayPointerUp() {
    draggingCorner = -1;
  }

  function undoCorner() {
    corners = corners.slice(0, -1);
    drawCornersOverlay();
  }

  function captureFrame() {
    const ctx = captureCanvas.getContext('2d');
    ctx.drawImage(videoEl, 0, 0);
    const imageData = ctx.getImageData(0, 0, captureCanvas.width, captureCanvas.height);
    rectifiedImageData = warpPerspective(imageData, sortCorners(corners));
  }

  function proceedToGrid() {
    captureFrame();
    phase = 'grid';
    drawGrid();
  }

  // ---- grid phase ----

  function eventToGridCoords(e, rect = null) {
    const r = rect ?? calibCanvas.getBoundingClientRect();
    const x = (e.clientX - r.left) * (rectifiedImageData.width / r.width);
    const y = (e.clientY - r.top) * (rectifiedImageData.height / r.height);
    return { x, y };
  }

  function calibPointerDown(e) {
    if (phase !== 'grid') return;
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

  function calibPointerMove(e) {
    if (phase !== 'grid' || draggingGridCorner < 0) return;
    const { x, y } = eventToGridCoords(e);
    gridCorners = gridCorners.map((c, i) => (i === draggingGridCorner ? { x, y } : c));
    drawGrid();
  }

  function calibPointerUp() {
    draggingGridCorner = -1;
  }

  function proceedToGridConfirm() {
    const result = transformFull(rectifiedImageData, gridCorners);
    correctedImageData = result.imageData;
    correctedCorners = result.corners;
    phase = 'grid-confirm';
    drawCorrected();
  }

  // ---- grid-confirm phase ----

  function bumpMag(which, delta) {
    if (which === 'min') minMag = Math.max(0, minMag + delta);
    else maxMag = Math.max(0, maxMag + delta);
    drawCorrected();
  }

  function recapture() {
    captureFrame();
    const result = transformFull(rectifiedImageData, gridCorners);
    correctedImageData = result.imageData;
    correctedCorners = result.corners;
    drawCorrected();
  }

  function proceedToEmptyBoard() {
    const calibrationBoard = new Board(correctedImageData, correctedCorners, { offsets });
    calibrationData = calibrationBoard.analyzeDetectionFunctions();
    const centerVsRingIndex = calibrationData.findIndex((fn) => fn.name === 'checkCenterVsRing');
    selectedFunctionIndex = centerVsRingIndex >= 0 ? centerVsRingIndex : 0;
    phase = 'empty-board';
    drawCorrected();
  }

  function captureBaseline() {
    const ctx = captureCanvas.getContext('2d');
    ctx.drawImage(videoEl, 0, 0);
    const videoImageData = ctx.getImageData(0, 0, captureCanvas.width, captureCanvas.height);
    const rectified = warpPerspective(videoImageData, sortCorners(corners));
    const result = transformFull(rectified, gridCorners);
    const emptyBoard = new Board(result.imageData, result.corners, { offsets });
    boardBaseline = calibrationData.map(({ fn }) => emptyBoard.getValues(fn));
    calibrationData = calibrationData.map((item) => ({
      ...item,
      blackCutoff: -30,
      whiteCutoff: 30
    }));
    phase = 'live';
    pollInterval = setInterval(poll, 500);
  }

  // ---- live phase ----

  function poll() {
    const ctx = captureCanvas.getContext('2d');
    ctx.drawImage(videoEl, 0, 0);
    const videoImageData = ctx.getImageData(0, 0, captureCanvas.width, captureCanvas.height);
    const rectified = warpPerspective(videoImageData, sortCorners(corners));
    const result = transformFull(rectified, gridCorners);
    const selected = calibrationData[selectedFunctionIndex];
    const board = new Board(result.imageData, result.corners, {
      detectionFunction: selected.fn,
      cutoffs: { black: selected.blackCutoff, white: selected.whiteCutoff },
      offsets
    });
    if (boardBaseline) {
      const values = board.getValues(selected.fn);
      const baseline = boardBaseline[selectedFunctionIndex];
      signMap = values.map((row, i) =>
        row.map((v, j) => {
          const delta = v - baseline[i][j];
          if (delta < selected.blackCutoff) return 1;
          if (delta > selected.whiteCutoff) return -1;
          return 0;
        })
      );
    } else {
      signMap = toSignMap(board.state);
    }
  }

  function recalibrate() {
    clearInterval(pollInterval);
    phase = 'corners';
    gridCorners = [];
    minMag = 0;
    maxMag = 0;
    cameraCol = 0;
    cameraRow = 18;
    calibrationData = [];
    selectedFunctionIndex = 0;
    boardBaseline = null;
    signMap = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0));
    rectifiedImageData = null;
    correctedImageData = null;
    correctedCorners = null;
    drawCornersOverlay();
  }

  // ---- drawing ----

  function drawCornersOverlay() {
    if (!overlayCanvas || !videoWidth) return;
    const ctx = overlayCanvas.getContext('2d');
    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

    const dotRadius = videoWidth / 40;
    if (corners.length >= 2) {
      const sortedForOutline = corners.length === 4 ? sortCorners(corners) : corners;
      const [topLeft, topRight, bottomLeft, bottomRight] = sortedForOutline;
      const outline =
        corners.length === 4 ? [topLeft, topRight, bottomRight, bottomLeft] : [topLeft, topRight];
      ctx.beginPath();
      ctx.moveTo(outline[0].x, outline[0].y);
      for (const c of outline.slice(1)) ctx.lineTo(c.x, c.y);
      if (corners.length === 4) ctx.closePath();
      ctx.strokeStyle = OUTLINE_COLOR;
      ctx.lineWidth = dotRadius * 0.2;
      ctx.stroke();
    }
    for (const [index, corner] of corners.entries()) {
      ctx.beginPath();
      ctx.arc(corner.x, corner.y, dotRadius, 0, Math.PI * 2);
      ctx.fillStyle = MARKER_COLOR;
      ctx.fill();
      ctx.fillStyle = 'white';
      ctx.font = `bold ${dotRadius * 1.1}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(index + 1, corner.x, corner.y);
    }
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
      ctx.fillStyle = MARKER_COLOR;
      ctx.fill();
    }

    if (gridCorners.length < 4) return;

    const H = computeH(sortCorners(gridCorners));
    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = GRID_LINE_WIDTH;
    for (let row = 0; row < BOARD_SIZE; row++) {
      ctx.beginPath();
      const rowStart = intersectionPoint(H, row, 0);
      ctx.moveTo(rowStart.x, rowStart.y);
      for (let col = 1; col < BOARD_SIZE; col++) {
        const pt = intersectionPoint(H, row, col);
        ctx.lineTo(pt.x, pt.y);
      }
      ctx.stroke();
    }
    for (let col = 0; col < BOARD_SIZE; col++) {
      ctx.beginPath();
      const colStart = intersectionPoint(H, 0, col);
      ctx.moveTo(colStart.x, colStart.y);
      for (let row = 1; row < BOARD_SIZE; row++) {
        const pt = intersectionPoint(H, row, col);
        ctx.lineTo(pt.x, pt.y);
      }
      ctx.stroke();
    }
  }

  function drawCorrected() {
    if (!calibCanvas || !correctedImageData || !correctedCorners) return;
    calibCanvas.width = correctedImageData.width;
    calibCanvas.height = correctedImageData.height;
    const ctx = calibCanvas.getContext('2d');
    ctx.putImageData(correctedImageData, 0, 0);

    const [topLeft, topRight, bottomLeft] = correctedCorners;
    const xStep = (topRight.x - topLeft.x) / 18;
    const yStep = (bottomLeft.y - topLeft.y) / 18;

    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = GRID_LINE_WIDTH;
    for (let row = 0; row < BOARD_SIZE; row++) {
      const y = topLeft.y + row * yStep;
      ctx.beginPath();
      ctx.moveTo(topLeft.x, y);
      ctx.lineTo(topRight.x, y);
      ctx.stroke();
    }
    for (let col = 0; col < BOARD_SIZE; col++) {
      const x = topLeft.x + col * xStep;
      ctx.beginPath();
      ctx.moveTo(x, topLeft.y);
      ctx.lineTo(x, bottomLeft.y);
      ctx.stroke();
    }

    ctx.fillStyle = GRID_COLOR;
    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        ctx.beginPath();
        ctx.arc(
          topLeft.x + col * xStep + offsets[row][col].x,
          topLeft.y + row * yStep + offsets[row][col].y,
          3,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
    }
  }
</script>

<div class="live-record">
  {#if cameraError}
    <p class="live-record__error">Camera access denied or unavailable.</p>
  {:else}
    <div class="live-record__controls">
      {#if phase === 'corners'}
        <p class="live-record__instruction">Tap the 4 corners of the board ({corners.length}/4)</p>
        <button onclick={undoCorner} disabled={corners.length === 0}>Undo</button>
        <button onclick={proceedToGrid} disabled={corners.length < 4}>Next</button>
      {:else if phase === 'grid'}
        <p class="live-record__instruction">
          Tap the corners of the grid! ({gridCorners.length}/4)
        </p>
        <button
          onclick={() => {
            gridCorners = [];
            drawGrid();
          }}>Undo</button
        >
        <button onclick={proceedToGridConfirm} disabled={gridCorners.length < 4}>Next</button>
      {:else if phase === 'grid-confirm'}
        <p class="live-record__instruction">Nudge the sample points onto the stones</p>
        <button
          onclick={() => {
            gridCorners = [];
            phase = 'grid';
            drawGrid();
          }}>Back</button
        >
        <button onclick={recapture}>Recapture</button>
        <div class="live-record__camera-picker">
          <button
            class="live-record__axis-btn live-record__axis-btn--up"
            onclick={() => {
              cameraRow -= 1;
              drawCorrected();
            }}>&#8593;</button
          >
          <button
            class="live-record__axis-btn live-record__axis-btn--left"
            onclick={() => {
              cameraCol -= 1;
              drawCorrected();
            }}>&#8592;</button
          >
          <button
            class="live-record__axis-btn live-record__axis-btn--right"
            onclick={() => {
              cameraCol += 1;
              drawCorrected();
            }}>&#8594;</button
          >
          <button
            class="live-record__axis-btn live-record__axis-btn--down"
            onclick={() => {
              cameraRow += 1;
              drawCorrected();
            }}>&#8595;</button
          >
        </div>
        <div class="live-record__camera-label">
          camera <span class="live-record__mag-value">({cameraCol}, {cameraRow})</span>
        </div>
        <div class="live-record__mag-row">
          <span>min</span>
          <button onclick={() => bumpMag('min', -1)}>&#8249;</button>
          <span class="live-record__mag-value">{minMag}</span>
          <button onclick={() => bumpMag('min', 1)}>&#8250;</button>
          <span class="live-record__mag-sep">·</span>
          <span>max</span>
          <button onclick={() => bumpMag('max', -1)}>&#8249;</button>
          <span class="live-record__mag-value">{maxMag}</span>
          <button onclick={() => bumpMag('max', 1)}>&#8250;</button>
        </div>
        <button onclick={proceedToEmptyBoard}>Next</button>
      {:else if phase === 'empty-board'}
        <p class="live-record__instruction">Clear the board, then capture the empty board</p>
        <button onclick={recapture}>Recapture</button>
        <button onclick={captureBaseline}>Capture baseline</button>
      {:else if phase === 'live'}
        <div class="live-record__stone-count">
          ● {signMap.flat().filter((v) => v === 1).length}
          &nbsp;·&nbsp;
          {signMap.flat().filter((v) => v === 0).length}
          &nbsp;·&nbsp; ○ {signMap.flat().filter((v) => v === -1).length}
        </div>
        <div class="live-record__algo-row">
          {#each calibrationData as fn, i}
            {@const blackCount = fn.sorted.filter((v) => v < fn.blackCutoff).length}
            {@const whiteCount = fn.sorted.filter((v) => v > fn.whiteCutoff).length}
            {@const emptyCount = fn.sorted.length - blackCount - whiteCount}
            <button
              class="live-record__algo-btn"
              class:live-record__algo-btn--active={selectedFunctionIndex === i}
              onclick={() => {
                selectedFunctionIndex = i;
              }}
            >
              {fn.name.replace(/^check/, '')}
              <span class="live-record__algo-counts">{blackCount}/{emptyCount}/{whiteCount}</span>
            </button>
          {/each}
        </div>
        {#if calibrationData[selectedFunctionIndex]}
          <div class="live-record__cutoffs">
            <span>●</span>
            <button
              onclick={() => {
                calibrationData[selectedFunctionIndex].blackCutoff -= 5;
              }}>&#8249;</button
            >
            <span class="live-record__cutoff-value"
              >{Math.round(calibrationData[selectedFunctionIndex].blackCutoff)}</span
            >
            <button
              onclick={() => {
                calibrationData[selectedFunctionIndex].blackCutoff += 5;
              }}>&#8250;</button
            >
            <span class="live-record__cutoff-sep">·</span>
            <button
              onclick={() => {
                calibrationData[selectedFunctionIndex].whiteCutoff -= 5;
              }}>&#8249;</button
            >
            <span class="live-record__cutoff-value"
              >{Math.round(calibrationData[selectedFunctionIndex].whiteCutoff)}</span
            >
            <button
              onclick={() => {
                calibrationData[selectedFunctionIndex].whiteCutoff += 5;
              }}>&#8250;</button
            >
            <span>○</span>
          </div>
        {/if}
        <button onclick={recalibrate}>Recalibrate</button>
      {/if}
    </div>

    <div class="live-record__camera" style:display={phase === 'corners' ? '' : 'none'}>
      <!-- svelte-ignore a11y_media_has_caption -->
      <video bind:this={videoEl} playsinline muted></video>
      <canvas
        class="live-record__overlay"
        bind:this={overlayCanvas}
        onpointerdown={overlayPointerDown}
        onpointermove={overlayPointerMove}
        onpointerup={overlayPointerUp}
      ></canvas>
    </div>

    <canvas
      class="live-record__calib"
      bind:this={calibCanvas}
      style:display={phase === 'grid' || phase === 'grid-confirm' || phase === 'empty-board'
        ? ''
        : 'none'}
      onpointerdown={calibPointerDown}
      onpointermove={calibPointerMove}
      onpointerup={calibPointerUp}
    ></canvas>

    <div class="live-record__board" style:display={phase === 'live' ? '' : 'none'}>
      <GoBoard {signMap} size={19} interactive={false} useTheme={false} />
    </div>

    <p class="live-record__attribution">
      Experimental &middot; Based on <a
        href="https://github.com/Seth-Rothschild/goban_irl"
        target="_blank"
        rel="noopener">goban_irl</a
      >
    </p>
  {/if}
</div>

<style>
  .live-record {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 1rem;
    gap: 0.75rem;
    box-sizing: border-box;
  }

  .live-record__camera {
    position: relative;
    flex: 1;
    min-height: 0;
    background: black;
  }

  video {
    width: 100%;
    height: 100%;
    object-fit: contain;
    display: block;
  }

  .live-record__overlay {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    cursor: crosshair;
    touch-action: none;
  }

  .live-record__calib {
    width: 100%;
    max-width: 500px;
    aspect-ratio: 1;
    align-self: center;
    cursor: crosshair;
    flex: 1;
    min-height: 0;
    touch-action: none;
  }

  .live-record__board {
    flex: 1;
    min-height: 0;
  }

  .live-record__controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }

  .live-record__instruction {
    margin: 0;
    flex-basis: 100%;
    text-align: center;
    font-size: 1.05rem;
  }

  .live-record__camera-picker {
    display: grid;
    grid-template-areas: '. up .' 'left . right' '. down .';
    grid-template-columns: repeat(3, 2.5rem);
    grid-template-rows: repeat(3, 2.5rem);
    gap: 0.15rem;
  }

  .live-record__axis-btn {
    width: 2.5rem;
    height: 2.5rem;
    padding: 0;
    font-size: 1.1rem;
  }

  .live-record__axis-btn--up {
    grid-area: up;
  }
  .live-record__axis-btn--left {
    grid-area: left;
  }
  .live-record__axis-btn--right {
    grid-area: right;
  }
  .live-record__axis-btn--down {
    grid-area: down;
  }

  .live-record__camera-label {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    flex-basis: 100%;
  }

  .live-record__mag-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.3rem;
    flex-basis: 100%;
  }

  .live-record__mag-value {
    min-width: 2.5rem;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }

  .live-record__mag-sep {
    margin: 0 0.75rem;
  }

  .live-record__stone-count {
    flex-basis: 100%;
    text-align: center;
    font-size: 1.05rem;
  }

  .live-record__algo-row {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.4rem;
    flex-basis: 100%;
  }

  .live-record__algo-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    font-size: 0.8rem;
    padding: 0.3rem 0.6rem;
    opacity: 0.6;
  }

  .live-record__algo-btn--active {
    opacity: 1;
    font-weight: bold;
  }

  .live-record__algo-counts {
    font-size: 0.7rem;
    opacity: 0.7;
  }

  .live-record__cutoffs {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.3rem;
    flex-basis: 100%;
  }

  .live-record__cutoff-value {
    min-width: 2.5rem;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }

  .live-record__cutoff-sep {
    margin: 0 0.75rem;
  }

  .live-record__attribution {
    margin: 0;
    font-size: 0.75rem;
    opacity: 0.5;
    text-align: center;
  }

  .live-record__error {
    color: red;
  }
</style>
