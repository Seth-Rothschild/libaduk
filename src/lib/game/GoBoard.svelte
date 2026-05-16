<script>
  import { onMount } from 'svelte';

  import { computeVertexSize } from '$lib/game/layout.js';
  import { stoneTheme } from '$lib/nav/stoneTheme.svelte.js';

  let {
    signMap,
    size = 19,
    lastMove = null,
    shiftMap = null,
    animatedVertex = null,
    onVertexClick,
    onCtrlClick = null,
    areaMap = null,
    deadStones = null,
    showCoords = false,
    currentSign = 1,
    markerMap = null,
    childrenMap = null,
    interactive = true,
    highlightVertex = null,
    pendingVertex = null,
    useTheme = true
  } = $props();

  let containerWidth = $state(0);
  let containerHeight = $state(0);
  const vertexSize = $derived(computeVertexSize(containerWidth, containerHeight, size));
  const half = $derived(vertexSize / 2);
  const fl = Math.floor;
  const COL_LETTERS = 'ABCDEFGHJKLMNOPQRST';

  function range(n) {
    return Array.from({ length: n }, (_, i) => i);
  }

  function getHoshis(w, h) {
    if (Math.min(w, h) <= 6) return [];
    const nearX = w >= 13 ? 3 : 2;
    const nearY = h >= 13 ? 3 : 2;
    const farX = w - nearX - 1;
    const farY = h - nearY - 1;
    const midX = (w - 1) / 2;
    const midY = (h - 1) / 2;
    const result = [
      [nearX, farY],
      [farX, nearY],
      [farX, farY],
      [nearX, nearY]
    ];
    if (w % 2 !== 0 && h % 2 !== 0 && w !== 7 && h !== 7) result.push([midX, midY]);
    if (w % 2 !== 0 && w !== 7) result.push([midX, nearY], [midX, farY]);
    if (h % 2 !== 0 && h !== 7) result.push([nearX, midY], [farX, midY]);
    return result;
  }

  const xs = $derived(range(size));
  const ys = $derived(range(size));

  const hLines = $derived(
    ys.map((_, i) => ({
      x: half,
      y: fl((2 * i + 1) * half - 0.5),
      width: fl((2 * size - 1) * half - half),
      height: 1
    }))
  );

  const vLines = $derived(
    xs.map((_, i) => ({
      x: fl((2 * i + 1) * half - 0.5),
      y: half,
      width: 1,
      height: fl((2 * size - 1) * half - half)
    }))
  );

  const hoshiPoints = $derived(
    getHoshis(size, size).map(([x, y]) => ({
      cx: fl((2 * x + 1) * half - 0.5) + 0.5,
      cy: fl((2 * y + 1) * half - 0.5) + 0.5
    }))
  );

  const svgSize = $derived(size * vertexSize);
  const boardSize = $derived(Math.round((size + (showCoords ? 1.3 : 0.8)) * vertexSize));

  const colLabels = $derived(COL_LETTERS.slice(0, size).split(''));
  const rowLabels = $derived(Array.from({ length: size }, (_, i) => size - i));

  const coordFontSize = $derived(Math.max(8, Math.round(vertexSize * 0.38)));
  const coordOffset = $derived(half * -0.5);

  const deadSet = $derived(
    deadStones ? new Set(deadStones.map(([x, y]) => `${x},${y}`)) : new Set()
  );

  const activeUrls = $derived(
    useTheme && stoneTheme.activeId !== null ? stoneTheme.urlsFor(stoneTheme.activeId) : null
  );

  function stoneUrl(sign, x, y) {
    const list = sign === 1 ? activeUrls?.black : activeUrls?.white;
    if (!list?.length) return null;
    const url = list[(x * 7 + y * 3) % list.length];
    return `url('${url}')`;
  }

  let coordMode = $state(false);

  onMount(() => {
    function isCoordKey(e) {
      return e.key === 'Control' || e.key === 'Meta';
    }
    function onKeyDown(e) {
      if (isCoordKey(e)) coordMode = true;
    }
    function onKeyUp(e) {
      if (isCoordKey(e)) coordMode = false;
    }
    function onBlur() {
      coordMode = false;
    }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  });

  function handleMouseDown(e) {
    if (e.ctrlKey || e.metaKey) e.preventDefault();
  }

  function handleClick(e) {
    const vertex = e.target.closest('.go-vertex');
    if (!vertex) return;
    const x = parseInt(vertex.dataset.x);
    const y = parseInt(vertex.dataset.y);
    if (e.ctrlKey || e.metaKey) {
      const coord = COL_LETTERS[x] + (size - y);
      onCtrlClick?.(coord);
      return;
    }
    onVertexClick?.(x, y);
  }
</script>

<div
  style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;"
  bind:clientWidth={containerWidth}
  bind:clientHeight={containerHeight}
>
  <div
    style="display: inline-grid; grid-template-columns: {boardSize}px; grid-template-rows: {boardSize}px; font-size: {vertexSize}px;"
  >
    <div
      class="go-goban go-goban-image"
      class:go-show-coords={showCoords}
      class:go-turn-black={currentSign === 1}
      class:go-turn-white={currentSign === -1}
      class:go-interactive={interactive && !coordMode}
      class:go-coord-mode={coordMode}
      style:background={activeUrls?.board
        ? `url('${activeUrls.board}') center/cover no-repeat`
        : (activeUrls?.boardColor ?? null)}
      style="display: inline-grid; line-height: 1em;"
      onmousedown={handleMouseDown}
      onclick={handleClick}
      role="img"
      aria-label="Go board, {size} by {size}"
    >
      <div class="go-content" style="position: relative; width: {size}em; height: {size}em;">
        <svg
          class="go-grid"
          width={svgSize}
          height={svgSize}
          style="position: absolute; top: 0; left: 0; z-index: 0;"
        >
          {#each hLines as line}
            <rect
              class="go-gridline"
              x={line.x}
              y={line.y}
              width={line.width}
              height={line.height}
            />
          {/each}
          {#each vLines as line}
            <rect
              class="go-gridline"
              x={line.x}
              y={line.y}
              width={line.width}
              height={line.height}
            />
          {/each}
          {#each hoshiPoints as h}
            <circle class="go-hoshi" cx={h.cx} cy={h.cy} r="2.4" />
          {/each}
        </svg>

        {#if showCoords}
          <svg
            class="go-coords"
            width={svgSize}
            height={svgSize}
            style="position: absolute; top: 0; left: 0; z-index: 0; pointer-events: none; overflow: visible;"
          >
            {#each colLabels as label, i}
              {@const cx = fl((2 * i + 1) * half - 0.5) + 0.5}
              <text
                x={cx}
                y={coordOffset}
                text-anchor="middle"
                dominant-baseline="middle"
                font-size={coordFontSize}
                class="go-coord-text">{label}</text
              >
              <text
                x={cx}
                y={svgSize - coordOffset}
                text-anchor="middle"
                dominant-baseline="middle"
                font-size={coordFontSize}
                class="go-coord-text">{label}</text
              >
            {/each}
            {#each rowLabels as num, i}
              {@const cy = fl((2 * i + 1) * half - 0.5) + 0.5}
              <text
                x={coordOffset}
                y={cy}
                text-anchor="middle"
                dominant-baseline="middle"
                font-size={coordFontSize}
                class="go-coord-text">{num}</text
              >
              <text
                x={svgSize - coordOffset}
                y={cy}
                text-anchor="middle"
                dominant-baseline="middle"
                font-size={coordFontSize}
                class="go-coord-text">{num}</text
              >
            {/each}
          </svg>
        {/if}

        <div
          class="go-vertices"
          style="display: grid; grid-template-columns: repeat({size}, 1em); grid-template-rows: repeat({size}, 1em); position: absolute; top: 0; left: 0; right: 0; bottom: 0; z-index: 1;"
        >
          {#each ys as y}
            {#each xs as x}
              {@const sign = signMap[y]?.[x] ?? 0}
              {@const shift = shiftMap?.[y]?.[x] ?? 0}
              {@const isLast = lastMove && lastMove[0] === x && lastMove[1] === y}
              {@const isAnimated =
                animatedVertex && animatedVertex[0] === x && animatedVertex[1] === y}
              {@const isDead = deadSet.has(`${x},${y}`)}
              {@const marker = markerMap?.[y]?.[x] ?? null}
              {@const childSign = childrenMap?.[y]?.[x] ?? 0}
              {@const territory = areaMap?.[y]?.[x] ?? 0}
              {@const isHighlighted =
                highlightVertex && highlightVertex[0] === x && highlightVertex[1] === y}
              <div
                class="go-vertex go-shift_{shift}"
                class:go-black={sign === 1}
                class:go-white={sign === -1}
                class:go-empty={sign === 0}
                class:go-animate={isAnimated}
                style="position: relative;"
                data-x={x}
                data-y={y}
              >
                {#if sign !== 0}
                  <div
                    class="go-stone"
                    class:go-dead={isDead}
                    style="position: absolute; z-index: 2;"
                  >
                    <div
                      class="go-inner go-sign_{sign}"
                      style:background-image={stoneUrl(sign, x, y)}
                    ></div>
                    {#if isLast && !isDead}
                      <svg class="go-last-marker" viewBox="0 0 1 1">
                        <circle
                          cx="0.5"
                          cy="0.5"
                          r="0.18"
                          class="go-last-marker-dot go-last-marker-dot_{sign}"
                        />
                      </svg>
                    {/if}
                    {#if isDead}
                      <svg class="go-dead-x" viewBox="0 0 1 1">
                        <line
                          x1="0.2"
                          y1="0.2"
                          x2="0.8"
                          y2="0.8"
                          stroke-width="0.12"
                          stroke-linecap="round"
                        />
                        <line
                          x1="0.8"
                          y1="0.2"
                          x2="0.2"
                          y2="0.8"
                          stroke-width="0.12"
                          stroke-linecap="round"
                        />
                      </svg>
                    {/if}
                  </div>
                {/if}
                {#if marker === 'cross'}
                  <svg class="go-marker" viewBox="0 0 1 1">
                    {#if sign === 0}
                      <rect
                        x="0.25"
                        y="0.25"
                        width="0.5"
                        height="0.5"
                        class="go-marker-bg"
                        stroke="none"
                      />
                    {/if}
                    <path
                      d="M 0 0 L .5 .5 M .5 0 L 0 .5"
                      transform="translate(.25 .25)"
                      class="go-marker-shape go-marker-on-{sign || 'empty'}"
                    />
                  </svg>
                {:else if marker === 'circle'}
                  <svg class="go-marker" viewBox="0 0 1 1">
                    <circle
                      cx="0.5"
                      cy="0.5"
                      r="0.22"
                      class="go-marker-shape go-marker-on-{sign || 'empty'}"
                    />
                  </svg>
                {:else if marker === 'square'}
                  <svg class="go-marker" viewBox="0 0 1 1">
                    <rect
                      x="0.25"
                      y="0.25"
                      width="0.5"
                      height="0.5"
                      class="go-marker-shape go-marker-on-{sign || 'empty'}"
                    />
                  </svg>
                {:else if marker === 'triangle'}
                  <svg class="go-marker" viewBox="0 0 1 1">
                    <path
                      d="M 0 .5 L .6 .5 L .3 0 z"
                      transform="translate(.2 .2)"
                      class="go-marker-shape go-marker-on-{sign || 'empty'}"
                    />
                  </svg>
                {:else if marker?.type === 'label' || marker?.type === 'number'}
                  <div class="go-marker-label go-marker-label-on-{sign || 'empty'}">
                    {marker.label}
                  </div>
                {/if}
                {#if sign === 0 && childSign !== 0}
                  <div class="go-ghost go-ghost-{childSign}"></div>
                {/if}
                {#if sign === 0 && pendingVertex && pendingVertex[0] === x && pendingVertex[1] === y}
                  <div class="go-ghost go-ghost-{currentSign}"></div>
                {/if}
                {#if sign === 0}
                  {#if territory !== 0}
                    <div
                      class="go-territory"
                      class:go-territory-black={territory > 0}
                      class:go-territory-white={territory < 0}
                    ></div>
                  {/if}
                {/if}
                {#if isHighlighted}
                  <div class="go-chat-highlight"></div>
                {/if}
              </div>
            {/each}
          {/each}
        </div>
      </div>
    </div>
  </div>
</div>
