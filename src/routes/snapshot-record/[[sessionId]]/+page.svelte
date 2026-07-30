<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import NavigationButtons from '$lib/game/NavigationButtons.svelte';
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
  import { exportSessionAsZip, importSessionFromZip } from '$lib/snapshot-record/exportImport.js';

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
  let isExporting = $state(false);
  let isImporting = $state(false);
  let importError = $state(false);

  let videoEl;
  let captureCanvas = document.createElement('canvas');
  let filmstripEl;
  let importInputEl;
  let stream = null;
  let wakeLock = null;
  let captureIntervalId = null;
  let elapsedIntervalId = null;
  let recordingStartedAt = null;
  let activeSessionId = null;
  let scrollUpdateScheduled = false;
  let handledSessionId;

  const selectedIndex = $derived(
    selectedFrame ? frames.findIndex((f) => f.frameId === selectedFrame.frameId) : -1
  );
  const reviewMenuItems = $derived([
    { label: isBuilding ? 'Building video…' : 'Download video', onclick: downloadVideo },
    { label: isExporting ? 'Exporting…' : 'Export images (.zip)', onclick: exportImages },
    { label: 'Reconstruct moves', href: `/snapshot-record/${activeSessionId}/reconstruct` }
  ]);

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

  async function teardownActive() {
    stopRecordingTimers();
    stopCamera();
    wakeLock?.release();
    wakeLock = null;
    if (phase === 'recording' && activeSessionId) {
      await setSessionStatus(activeSessionId, 'stopped');
    }
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
    await teardownActive();
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
    await teardownActive();
    await loadReview();
  }

  async function loadSessions() {
    for (const session of sessions) {
      if (session.thumbnailUrl) URL.revokeObjectURL(session.thumbnailUrl);
    }
    const rawSessions = await getAllSessions();
    sessions = await Promise.all(
      rawSessions.map(async (session) => {
        const sessionFrames = await getFrames(session.sessionId);
        const thumbnailUrl = sessionFrames[0] ? URL.createObjectURL(sessionFrames[0].blob) : null;
        const totalBytes = sessionFrames.reduce((sum, frame) => sum + frame.blob.size, 0);
        return { ...session, frameCount: sessionFrames.length, thumbnailUrl, totalBytes };
      })
    );
  }

  function formatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    const kilobytes = bytes / 1024;
    if (kilobytes < 1024) return `${kilobytes.toFixed(1)} KB`;
    const megabytes = kilobytes / 1024;
    return `${megabytes.toFixed(1)} MB`;
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

  function selectFirst() {
    moveSelection(-Infinity);
  }

  function selectLast() {
    moveSelection(Infinity);
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

  async function exportImages() {
    isExporting = true;
    try {
      const session = await getSession(activeSessionId);
      const blob = await exportSessionAsZip(session);
      downloadBlob(blob, `snapshot-record-${activeSessionId}.zip`);
    } finally {
      isExporting = false;
    }
  }

  function triggerImport() {
    importInputEl?.click();
  }

  async function handleImportFile(e) {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    isImporting = true;
    importError = false;
    try {
      const sessionId = await importSessionFromZip(file);
      await goto(`/snapshot-record/${sessionId}`);
    } catch {
      importError = true;
    } finally {
      isImporting = false;
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
      for (const session of sessions) {
        if (session.thumbnailUrl) URL.revokeObjectURL(session.thumbnailUrl);
      }
    };
  });
</script>

<svelte:window onkeydown={handleKeydown} />

{#snippet sidebar()}
  <div class="snapshot-record__sidebar">
    {#if phase === 'idle'}
      <div class="snapshot-record__sidebar-actions">
        <button class="button" onclick={startRecording} disabled={cameraError}>
          Start recording
        </button>
        <button class="button button-empty" onclick={triggerImport} disabled={isImporting}>
          {isImporting ? 'Importing…' : 'Import session (.zip)'}
        </button>
        {#if cameraError}
          <p class="snapshot-record__error">Camera access denied or unavailable.</p>
        {/if}
        {#if importError}
          <p class="snapshot-record__error">
            Could not read that file as a snapshot-record export.
          </p>
        {/if}
      </div>
    {:else if phase === 'review'}
      <div class="snapshot-record__sidebar-actions">
        <a class="button button-empty" href="/snapshot-record">New session</a>
        <button class="button button-red" onclick={() => (confirmingDiscard = true)}>
          Discard session
        </button>
      </div>
    {/if}

    {#if sessions.length > 0 && phase !== 'recording'}
      <div class="snapshot-record__sessions">
        <h2 class="snapshot-record__sessions-title">Previous sessions</h2>
        <ul class="snapshot-record__session-list">
          {#each sessions as session (session.sessionId)}
            <li>
              <a class="snapshot-record__session" href="/snapshot-record/{session.sessionId}">
                <div class="snapshot-record__session-thumb">
                  {#if session.thumbnailUrl}
                    <img src={session.thumbnailUrl} alt="" />
                  {/if}
                </div>
                <div class="snapshot-record__session-info">
                  <span class="snapshot-record__session-date">
                    {new Date(session.startedAt).toLocaleString()}
                  </span>
                  <span class="snapshot-record__session-meta">
                    {session.frameCount}
                    {session.frameCount === 1 ? 'frame' : 'frames'} ·
                    {formatSize(session.totalBytes)}
                  </span>
                </div>
              </a>
            </li>
          {/each}
        </ul>
      </div>
    {/if}
  </div>
{/snippet}

<div class="snapshot-record">
  <div class="snapshot-record__layout">
    <div class="snapshot-record__main">
      {#if phase !== 'review'}
        <div
          class="snapshot-record__card snapshot-record__camera-card"
          style:display={phase === 'recording' && !showPreview ? 'none' : ''}
        >
          <!-- svelte-ignore a11y_media_has_caption -->
          <video bind:this={videoEl} playsinline muted></video>
        </div>
      {/if}

      {#if phase === 'idle'}
        <p class="snapshot-record__instruction">Line up the board, then start recording.</p>
      {:else if phase === 'recording'}
        <div class="snapshot-record__panel">
          <div class="snapshot-record__recording-indicator">
            <span class="snapshot-record__dot"></span>
            Recording · {formatElapsed(elapsedSeconds)} · {frameCount}
            {frameCount === 1 ? 'frame' : 'frames'}
          </div>
          <label class="snapshot-record__preview-toggle">
            <input type="checkbox" bind:checked={showPreview} /> Show preview
          </label>
          <button class="button button-red" onclick={stopRecording}>Stop</button>
        </div>
      {:else if phase === 'review'}
        <div class="snapshot-record__card snapshot-record__preview">
          {#if selectedFrame}
            <img src={selectedFrame.url} alt="" />
          {/if}
        </div>

        <NavigationButtons
          canPrev={selectedIndex > 0}
          canNext={selectedIndex >= 0 && selectedIndex < frames.length - 1}
          onFirst={selectFirst}
          onPrev={() => moveSelection(-1)}
          onNext={() => moveSelection(1)}
          onLast={selectLast}
          menuItems={reviewMenuItems}
        />

        {#if confirmingDiscard}
          <div class="snapshot-record__overlay">
            <div class="snapshot-record__confirm">
              <p>Delete this recording? This can't be undone.</p>
              <div class="snapshot-record__confirm-actions">
                <button class="button button-red" onclick={discardSession}>Yes, discard</button>
                <button class="button button-empty" onclick={() => (confirmingDiscard = false)}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        {/if}

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

    {@render sidebar()}
  </div>
</div>

<input
  type="file"
  accept=".zip"
  style="display: none"
  bind:this={importInputEl}
  onchange={handleImportFile}
/>

<style>
  .snapshot-record {
    display: flex;
    flex-direction: column;
    height: 100%;
    max-width: 960px;
    margin: 0 auto;
    padding: 1rem;
    gap: 1rem;
    box-sizing: border-box;
  }

  .snapshot-record__layout {
    display: grid;
    grid-template-areas: 'main' 'sessions';
    gap: 1.5rem;
    min-height: 0;
  }

  @media (min-width: 800px) {
    .snapshot-record__layout:has(:global(.snapshot-record__sidebar)) {
      grid-template-areas: 'main sessions';
      grid-template-columns: minmax(0, 1fr) 280px;
      align-items: start;
    }
  }

  .snapshot-record__main {
    grid-area: main;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    min-width: 0;
  }

  .snapshot-record__sidebar {
    grid-area: sessions;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .snapshot-record__panel {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    align-items: center;
  }

  .snapshot-record__card {
    border-radius: 7px;
    box-shadow:
      0 2px 2px 0 rgba(0, 0, 0, 0.14),
      0 3px 1px -2px rgba(0, 0, 0, 0.2),
      0 1px 5px 0 rgba(0, 0, 0, 0.12);
    overflow: hidden;
    background: black;
  }

  .snapshot-record__camera-card {
    width: 100%;
    aspect-ratio: 4 / 3;
  }

  .snapshot-record__camera-card video {
    width: 100%;
    height: 100%;
    object-fit: contain;
    display: block;
  }

  .snapshot-record__instruction {
    margin: 0;
    text-align: center;
    font-size: 1.05rem;
  }

  .snapshot-record__error {
    color: var(--c-bad);
    text-align: center;
  }

  .snapshot-record__sidebar-actions {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .snapshot-record__sidebar-actions .button {
    width: 100%;
  }

  .snapshot-record__sessions {
    width: 100%;
  }

  .snapshot-record__sessions-title {
    font-size: 0.95rem;
    text-align: center;
    opacity: 0.7;
    margin: 0 0 0.5rem;
  }

  @media (min-width: 800px) {
    .snapshot-record__sessions-title {
      text-align: left;
    }
  }

  .snapshot-record__session-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .snapshot-record__session {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.5rem 0.7rem;
    border-radius: 7px;
    border: 1px solid var(--c-border);
    background: var(--c-bg-box);
    text-decoration: none;
    color: var(--c-font);
    box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
  }

  .snapshot-record__session:hover {
    background: var(--c-bg-high);
  }

  .snapshot-record__session-thumb {
    flex: 0 0 auto;
    width: 56px;
    height: 40px;
    border-radius: 4px;
    overflow: hidden;
    background: var(--c-bg-high);
  }

  .snapshot-record__session-thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .snapshot-record__session-info {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    min-width: 0;
    font-size: 0.9rem;
  }

  .snapshot-record__session-date {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .snapshot-record__session-meta {
    font-size: 0.85em;
    opacity: 0.7;
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
    background: var(--c-bad);
  }

  .snapshot-record__preview-toggle {
    display: flex;
    align-items: center;
    gap: 0.3rem;
  }

  .snapshot-record__overlay {
    position: fixed;
    inset: 0;
    z-index: 200;
    background: rgba(0, 0, 0, 0.65);
    display: grid;
  }

  .snapshot-record__confirm {
    margin: auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    width: 320px;
    max-width: calc(100vw - 2rem);
    padding: 1.5rem;
    border-radius: 7px;
    background: var(--c-bg-box);
    box-shadow: 0 5px 20px rgba(0, 0, 0, 0.5);
    text-align: center;
  }

  .snapshot-record__confirm-actions {
    display: flex;
    gap: 0.5rem;
  }

  .snapshot-record__preview {
    flex: 1;
    min-height: 0;
    display: flex;
    align-items: center;
    justify-content: center;
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
