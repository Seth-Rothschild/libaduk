<script>
  import { onMount } from 'svelte';
  import GoBoard from '$lib/game/GoBoard.svelte';
  import {
    sortCorners,
    warpPerspective,
    transformFull,
    computeH,
    intersectionPoint
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
  let stoneOffsetX = $state(0);
  let stoneOffsetY = $state(0);
  let calibrationData = $state([]);
  let selectedFunctionIndex = $state(0);

  let videoEl;
  let overlayCanvas;
  let calibCanvas = $state(null);
  let captureCanvas;
  let pollInterval;
  let draggingGridCorner = -1;
  let videoWidth = 0;
  let videoHeight = 0;
  let rectifiedImageData = null;
  let correctedImageData = null;
  let correctedCorners = null;

  onMount(async () => {
    captureCanvas = document.createElement('canvas');

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
      return;
    }

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

    return () => {
      stream.getTracks().forEach((t) => t.stop());
      clearInterval(pollInterval);
    };
  });

  // ---- corners phase ----

  function eventToVideoCoords(e) {
    const rect = overlayCanvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (videoWidth / rect.width);
    const y = (e.clientY - rect.top) * (videoHeight / rect.height);
    return { x, y };
  }

  function overlayPointerDown(e) {
    if (phase !== 'corners' || corners.length >= 4) return;
    const { x, y } = eventToVideoCoords(e);
    corners = [...corners, { x, y }];
    drawCornersOverlay();
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

  function eventToGridCoords(e) {
    const rect = calibCanvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (rectifiedImageData.width / rect.width);
    const y = (e.clientY - rect.top) * (rectifiedImageData.height / rect.height);
    return { x, y };
  }

  function calibPointerDown(e) {
    if (phase !== 'grid') return;
    const { x, y } = eventToGridCoords(e);
    const hitRadius = rectifiedImageData.width / 25;
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

  function nudge(dx, dy) {
    stoneOffsetX += dx;
    stoneOffsetY += dy;
    drawCorrected();
  }

  function recapture() {
    captureFrame();
    const result = transformFull(rectifiedImageData, gridCorners);
    correctedImageData = result.imageData;
    correctedCorners = result.corners;
    drawCorrected();
  }

  function startRecording() {
    const calibrationBoard = new Board(correctedImageData, correctedCorners, {
      offsetX: stoneOffsetX,
      offsetY: stoneOffsetY
    });
    calibrationData = calibrationBoard.analyzeDetectionFunctions();
    const centerBrightnessIndex = calibrationData.findIndex(
      (fn) => fn.name === 'checkCenterBrightness'
    );
    selectedFunctionIndex = centerBrightnessIndex >= 0 ? centerBrightnessIndex : 0;
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
      offsetX: stoneOffsetX,
      offsetY: stoneOffsetY
    });
    signMap = toSignMap(board.state);
  }

  function recalibrate() {
    clearInterval(pollInterval);
    phase = 'corners';
    gridCorners = [];
    stoneOffsetX = 0;
    stoneOffsetY = 0;
    calibrationData = [];
    selectedFunctionIndex = 0;
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

    const dotRadius = videoWidth / 60;
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
      ctx.arc(corner.x, corner.y, 8, 0, Math.PI * 2);
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
          topLeft.x + col * xStep + stoneOffsetX,
          topLeft.y + row * yStep + stoneOffsetY,
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
    <div class="live-record__camera" style:display={phase === 'corners' ? '' : 'none'}>
      <!-- svelte-ignore a11y_media_has_caption -->
      <video bind:this={videoEl} playsinline muted></video>
      <canvas
        class="live-record__overlay"
        bind:this={overlayCanvas}
        onpointerdown={overlayPointerDown}
      ></canvas>
    </div>

    <canvas
      class="live-record__calib"
      bind:this={calibCanvas}
      style:display={phase === 'grid' || phase === 'grid-confirm' ? '' : 'none'}
      onpointerdown={calibPointerDown}
      onpointermove={calibPointerMove}
      onpointerup={calibPointerUp}
    ></canvas>

    <div class="live-record__board" style:display={phase === 'live' ? '' : 'none'}>
      <GoBoard {signMap} size={19} interactive={false} useTheme={false} />
    </div>

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
        <div class="live-record__nudge-pad">
          <button class="live-record__nudge-btn" onclick={() => nudge(0, -3)}>&#8963;</button>
          <button class="live-record__nudge-btn" onclick={() => nudge(-3, 0)}>&#8249;</button>
          <button class="live-record__nudge-btn" onclick={() => nudge(3, 0)}>&#8250;</button>
          <button class="live-record__nudge-btn" onclick={() => nudge(0, 3)}>&#8964;</button>
        </div>
        <button onclick={startRecording}>Start recording</button>
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
  }

  .live-record__calib {
    width: 100%;
    max-width: 500px;
    aspect-ratio: 1;
    align-self: center;
    cursor: crosshair;
    flex: 1;
    min-height: 0;
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

  .live-record__nudge-pad {
    display: grid;
    grid-template-areas: '. up .' 'left . right' '. down .';
    grid-template-columns: repeat(3, 2.5rem);
    grid-template-rows: repeat(3, 2.5rem);
    gap: 0.15rem;
  }

  .live-record__nudge-btn {
    width: 2.5rem;
    height: 2.5rem;
    padding: 0;
    font-size: 1.1rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .live-record__nudge-btn:nth-child(1) {
    grid-area: up;
  }
  .live-record__nudge-btn:nth-child(2) {
    grid-area: left;
  }
  .live-record__nudge-btn:nth-child(3) {
    grid-area: right;
  }
  .live-record__nudge-btn:nth-child(4) {
    grid-area: down;
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
