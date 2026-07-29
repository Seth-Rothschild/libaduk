<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import {
    createSession,
    getAllSessions,
    getSession,
    setSessionStatus,
    addFrame,
    getFrames,
    deleteFrame,
    deleteSession
  } from '$lib/snapshot-record/db.js';
  import { buildVideoFromFrames, downloadBlob } from '$lib/snapshot-record/video.js';

  const CAPTURE_INTERVAL_MS = 20000;

  let phase = $state('idle');
  let elapsedSeconds = $state(0);
  let frameCount = $state(0);
  let showPreview = $state(false);
  let cameraError = $state(false);
  let frames = $state([]);
  let sessions = $state([]);
  let selectedFrame = $state(null);
  let confirmingDiscard = $state(false);
  let isBuilding = $state(false);

  let videoEl;
  let captureCanvas = document.createElement('canvas');
  let filmstripEl;
  let stream = null;
  let wakeLock = null;
  let captureIntervalId = null;
  let elapsedIntervalId = null;
  let recordingStartedAt = null;
  let activeSessionId = null;
  let scrollUpdateScheduled = false;
  let handledSessionId;

  function formatElapsed(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }

  async function acquireWakeLock() {
    try {
      wakeLock = await navigator.wakeLock.request('screen');
    } catch {
      wakeLock = null;
    }
  }

  async function startCamera() {
    cameraError = false;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          frameRate: { max: 1 }
        }
      });
    } catch {
      cameraError = true;
      return;
    }
    videoEl.srcObject = stream;
    videoEl.addEventListener('loadedmetadata', () => {
      captureCanvas.width = videoEl.videoWidth;
      captureCanvas.height = videoEl.videoHeight;
    });
    await videoEl.play();
  }

  function stopCamera() {
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;
  }

  function captureTick() {
    if (!stream) return;
    const ctx = captureCanvas.getContext('2d');
    ctx.drawImage(videoEl, 0, 0, captureCanvas.width, captureCanvas.height);
    captureCanvas.toBlob(
      async (blob) => {
        if (!blob) return;
        await addFrame(activeSessionId, blob, Date.now());
        frameCount += 1;
      },
      'image/jpeg',
      0.7
    );
  }

  function beginRecordingTimers() {
    captureIntervalId = setInterval(captureTick, CAPTURE_INTERVAL_MS);
    elapsedIntervalId = setInterval(() => {
      elapsedSeconds = Math.floor((Date.now() - recordingStartedAt) / 1000);
    }, 1000);
  }

  function stopRecordingTimers() {
    clearInterval(captureIntervalId);
    clearInterval(elapsedIntervalId);
    captureIntervalId = null;
    elapsedIntervalId = null;
  }

  function teardownActive() {
    stopRecordingTimers();
    stopCamera();
    wakeLock?.release();
    wakeLock = null;
  }

  async function startRecording() {
    activeSessionId = crypto.randomUUID();
    handledSessionId = activeSessionId;
    await createSession(activeSessionId);
    goto(`/snapshot-record/${activeSessionId}`);
    recordingStartedAt = Date.now();
    elapsedSeconds = 0;
    frameCount = 0;
    phase = 'recording';
    beginRecordingTimers();
    acquireWakeLock();
  }

  async function loadForSession(sessionId) {
    teardownActive();
    if (!sessionId) {
      activeSessionId = null;
      phase = 'idle';
      await startCamera();
      await loadSessions();
      return;
    }
    const session = await getSession(sessionId);
    if (session?.status === 'recording') {
      await resumeRecording(session);
    } else if (session?.status === 'stopped') {
      activeSessionId = sessionId;
      await loadReview();
    } else {
      activeSessionId = null;
      phase = 'idle';
      await startCamera();
      await loadSessions();
    }
  }

  async function resumeRecording(session) {
    activeSessionId = session.sessionId;
    recordingStartedAt = session.startedAt;
    elapsedSeconds = Math.floor((Date.now() - recordingStartedAt) / 1000);
    frameCount = (await getFrames(activeSessionId)).length;
    await startCamera();
    if (cameraError) return;
    phase = 'recording';
    beginRecordingTimers();
    acquireWakeLock();
  }

  async function stopRecording() {
    stopRecordingTimers();
    await setSessionStatus(activeSessionId, 'stopped');
    stopCamera();
    wakeLock?.release();
    wakeLock = null;
    await loadReview();
  }

  async function loadSessions() {
    sessions = await getAllSessions();
  }

  async function loadReview() {
    const stored = await getFrames(activeSessionId);
    frames = stored.map((frame) => ({ ...frame, url: URL.createObjectURL(frame.blob) }));
    selectedFrame = frames[0] ?? null;
    phase = 'review';
    await loadSessions();
  }

  async function removeFrame(frame) {
    await deleteFrame(frame.frameId);
    URL.revokeObjectURL(frame.url);
    frames = frames.filter((f) => f.frameId !== frame.frameId);
    if (selectedFrame?.frameId === frame.frameId) selectedFrame = frames[0] ?? null;
  }

  function handleFilmstripScroll() {
    if (scrollUpdateScheduled) return;
    scrollUpdateScheduled = true;
    requestAnimationFrame(() => {
      scrollUpdateScheduled = false;
      updateSelectedFromScroll();
    });
  }

  function moveSelection(delta) {
    if (frames.length === 0) return;
    const currentIndex = selectedFrame
      ? frames.findIndex((f) => f.frameId === selectedFrame.frameId)
      : 0;
    const nextIndex = Math.min(Math.max(currentIndex + delta, 0), frames.length - 1);
    selectedFrame = frames[nextIndex];
    filmstripEl?.children[nextIndex]?.scrollIntoView({
      behavior: 'smooth',
      inline: 'center',
      block: 'nearest'
    });
  }

  function handleKeydown(e) {
    if (phase !== 'review') return;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      moveSelection(-1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      moveSelection(1);
    }
  }

  function updateSelectedFromScroll() {
    if (!filmstripEl) return;
    const containerCenter = filmstripEl.getBoundingClientRect().left + filmstripEl.clientWidth / 2;
    let closestIndex = 0;
    let closestDistance = Infinity;
    for (const child of filmstripEl.children) {
      const rect = child.getBoundingClientRect();
      const distance = Math.abs(rect.left + rect.width / 2 - containerCenter);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = Number(child.dataset.index);
      }
    }
    selectedFrame = frames[closestIndex] ?? selectedFrame;
  }

  async function downloadVideo() {
    isBuilding = true;
    try {
      const blob = await buildVideoFromFrames(frames);
      const extension = blob.type.includes('mp4') ? 'mp4' : 'webm';
      downloadBlob(blob, `snapshot-record-${activeSessionId}.${extension}`);
    } finally {
      isBuilding = false;
    }
  }

  async function discardSession() {
    await deleteSession(activeSessionId);
    for (const frame of frames) URL.revokeObjectURL(frame.url);
    frames = [];
    confirmingDiscard = false;
    handledSessionId = null;
    await goto('/snapshot-record');
    await loadForSession(null);
  }

  $effect(() => {
    const sessionId = page.params.sessionId ?? null;
    if (sessionId === handledSessionId) return;
    handledSessionId = sessionId;
    loadForSession(sessionId);
  });

  onMount(() => {
    return () => {
      teardownActive();
      for (const frame of frames) URL.revokeObjectURL(frame.url);
    };
  });
</script>

<svelte:window onkeydown={handleKeydown} />

{#snippet sessionList()}
  {#if sessions.length > 0}
    <div class="snapshot-record__sessions">
      <a class="button button-empty snapshot-record__new-session" href="/snapshot-record">
        New session
      </a>
      <h2 class="snapshot-record__sessions-title">Previous sessions</h2>
      <ul class="snapshot-record__session-list">
        {#each sessions as session (session.sessionId)}
          <li>
            <a href="/snapshot-record/{session.sessionId}">
              {new Date(session.startedAt).toLocaleString()}
              <span class="snapshot-record__session-status">{session.status}</span>
            </a>
          </li>
        {/each}
      </ul>
    </div>
  {/if}
{/snippet}

<div class="snapshot-record">
  {#if phase !== 'review'}
    <div
      class="snapshot-record__camera"
      style:display={phase === 'recording' && !showPreview ? 'none' : ''}
    >
      <!-- svelte-ignore a11y_media_has_caption -->
      <video bind:this={videoEl} playsinline muted></video>
    </div>
  {/if}

  <div class="snapshot-record__controls">
    {#if phase === 'idle'}
      <p class="snapshot-record__instruction">Line up the board, then start recording.</p>
      {#if cameraError}
        <p class="snapshot-record__error">Camera access denied or unavailable.</p>
      {/if}
      <button class="button" onclick={startRecording} disabled={cameraError}>
        Start recording
      </button>
      {@render sessionList()}
    {:else if phase === 'recording'}
      <div class="snapshot-record__recording-indicator">
        <span class="snapshot-record__dot"></span>
        Recording · {formatElapsed(elapsedSeconds)} · {frameCount}
        {frameCount === 1 ? 'frame' : 'frames'}
      </div>
      <label class="snapshot-record__preview-toggle">
        <input type="checkbox" bind:checked={showPreview} /> Show preview
      </label>
      <button class="button button-red" onclick={stopRecording}>Stop</button>
    {:else if phase === 'review'}
      <div class="snapshot-record__review-actions">
        <button class="button" onclick={downloadVideo} disabled={isBuilding || frames.length === 0}>
          {isBuilding ? 'Building video…' : 'Download video'}
        </button>
        <button class="button button-red" onclick={() => (confirmingDiscard = true)}>
          Discard session
        </button>
      </div>
      {#if confirmingDiscard}
        <div class="snapshot-record__confirm">
          <p>Delete this recording? This can't be undone.</p>
          <button class="button button-red" onclick={discardSession}>Yes, discard</button>
          <button class="button button-empty" onclick={() => (confirmingDiscard = false)}>
            Cancel
          </button>
        </div>
      {/if}
      {@render sessionList()}
    {/if}
  </div>

  {#if phase === 'review'}
    <div class="snapshot-record__preview">
      {#if selectedFrame}
        <img src={selectedFrame.url} alt="" />
      {/if}
    </div>
    <div
      class="snapshot-record__filmstrip"
      bind:this={filmstripEl}
      onscroll={handleFilmstripScroll}
    >
      {#each frames as frame, i (frame.frameId)}
        <div
          class="snapshot-record__thumb"
          class:snapshot-record__thumb--active={selectedFrame?.frameId === frame.frameId}
          role="button"
          tabindex="0"
          data-index={i}
          onclick={() => (selectedFrame = frame)}
          onkeydown={(e) => {
            if (e.key === 'Enter') selectedFrame = frame;
          }}
        >
          <img src={frame.url} alt="" />
          <button
            class="snapshot-record__thumb-delete"
            aria-label="Delete frame"
            onclick={(e) => {
              e.stopPropagation();
              removeFrame(frame);
            }}>&times;</button
          >
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .snapshot-record {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 1rem;
    gap: 0.75rem;
    box-sizing: border-box;
  }

  .snapshot-record__camera {
    position: relative;
    flex: 1;
    min-height: 0;
    background: black;
  }

  .snapshot-record__camera video {
    width: 100%;
    height: 100%;
    object-fit: contain;
    display: block;
  }

  .snapshot-record__controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }

  .snapshot-record__instruction {
    margin: 0;
    flex-basis: 100%;
    text-align: center;
    font-size: 1.05rem;
  }

  .snapshot-record__error {
    color: red;
    flex-basis: 100%;
    text-align: center;
  }

  .snapshot-record__sessions {
    flex-basis: 100%;
    max-width: 24rem;
    margin: 0 auto;
  }

  .snapshot-record__new-session {
    display: block;
    width: fit-content;
    margin: 0 auto 0.75rem;
  }

  .snapshot-record__sessions-title {
    font-size: 0.95rem;
    text-align: center;
    opacity: 0.7;
    margin: 0 0 0.5rem;
  }

  .snapshot-record__session-list {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .snapshot-record__session-list a {
    display: flex;
    justify-content: space-between;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--c-border);
    border-radius: 6px;
    text-decoration: none;
    color: var(--c-font);
  }

  .snapshot-record__session-list a:hover {
    background: var(--c-bg-high);
  }

  .snapshot-record__session-status {
    opacity: 0.6;
    text-transform: capitalize;
  }

  .snapshot-record__recording-indicator {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 1.05rem;
  }

  .snapshot-record__dot {
    width: 0.7rem;
    height: 0.7rem;
    border-radius: 50%;
    background: red;
  }

  .snapshot-record__preview-toggle {
    display: flex;
    align-items: center;
    gap: 0.3rem;
  }

  .snapshot-record__review-actions {
    display: flex;
    gap: 0.5rem;
  }

  .snapshot-record__confirm {
    flex-basis: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
  }

  .snapshot-record__preview {
    flex: 1;
    min-height: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: black;
  }

  .snapshot-record__preview img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }

  .snapshot-record__filmstrip {
    display: flex;
    gap: 4px;
    overflow-x: auto;
    padding: 0.5rem 50%;
    scroll-snap-type: x proximity;
  }

  .snapshot-record__thumb {
    position: relative;
    flex: 0 0 auto;
    width: 96px;
    height: 68px;
    cursor: pointer;
    scroll-snap-align: center;
    border: 2px solid transparent;
    border-radius: 4px;
    overflow: hidden;
    opacity: 0.6;
    transition:
      opacity 0.15s ease,
      border-color 0.15s ease;
  }

  .snapshot-record__thumb--active {
    opacity: 1;
    border-color: var(--c-primary);
  }

  .snapshot-record__thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .snapshot-record__thumb-delete {
    position: absolute;
    top: 0.2rem;
    right: 0.2rem;
    width: 1.4rem;
    height: 1.4rem;
    padding: 0;
    line-height: 1;
    opacity: 0.35;
    background: rgba(0, 0, 0, 0.5);
    color: white;
    border-radius: 50%;
  }

  .snapshot-record__thumb-delete:hover {
    opacity: 1;
  }
</style>
