<script>
  import { onMount } from 'svelte';

  let { root, currentNode, onSelectNode, version = 0, moveNum = null } = $props();

  const GRID = 22;
  const NODE_RADIUS = 5;

  let containerEl;
  let svgWidth = $state(0);
  let svgHeight = $state(0);
  let cameraX = $state(0);
  let cameraY = $state(0);

  let layoutData = $derived.by(() => {
    version;
    if (!root) return { nodes: [], edges: [] };
    return buildLayout(root);
  });

  let currentPos = $derived.by(() => {
    for (const n of layoutData.nodes) {
      if (n.node === currentNode) return { x: n.x, y: n.y };
    }
    return null;
  });

  $effect(() => {
    if (!currentPos) return;
    const targetX = currentPos.x * GRID - svgWidth / 2;
    const targetY = currentPos.y * GRID - svgHeight / 2;
    cameraX = Math.round(targetX);
    cameraY = Math.round(Math.max(0, targetY));
  });

  function buildLayout(rootNode) {
    const nodes = [];
    const edges = [];
    const dict = new Map();

    function isOccupied(x, y) {
      for (const [, pos] of dict) {
        if (pos.x === x && pos.y === y) return true;
      }
      return false;
    }

    function layoutSequence(node, xshift, yshift) {
      const sequence = [];
      let current = node;
      while (true) {
        sequence.push(current);
        if (current.children.length !== 1) break;
        current = current.children[0];
      }

      let x = xshift;

      for (let i = 0; i < sequence.length; i++) {
        const y = yshift + i;
        while (isOccupied(x, y)) {
          x++;
        }
        dict.set(sequence[i], { x, y });
        nodes.push({
          node: sequence[i],
          x,
          y,
          isPass: sequence[i].lastMove === null && sequence[i].parent !== null,
          hasBookmark: !!sequence[i].bookmark,
          hasComment: !!sequence[i].comment
        });
      }

      for (let i = 0; i < sequence.length - 1; i++) {
        const fromPos = dict.get(sequence[i]);
        const toPos = dict.get(sequence[i + 1]);
        edges.push({
          x1: fromPos.x,
          y1: fromPos.y,
          x2: toPos.x,
          y2: toPos.y,
          current: false
        });
      }

      const lastNode = sequence[sequence.length - 1];
      const lastPos = dict.get(lastNode);

      if (lastNode.children.length > 1) {
        for (let k = 0; k < lastNode.children.length; k++) {
          const child = lastNode.children[k];
          layoutSequence(child, lastPos.x + k, lastPos.y + 1);
          const childPos = dict.get(child);
          edges.push({
            x1: lastPos.x,
            y1: lastPos.y,
            x2: childPos.x,
            y2: childPos.y,
            current: false
          });
        }
      }
    }

    layoutSequence(rootNode, 0, 1);

    const currentPath = new Set();
    let walk = currentNode;
    while (walk) {
      currentPath.add(walk);
      walk = walk.parent;
    }

    for (const edge of edges) {
      const sourceNode = nodes.find((n) => n.x === edge.x1 && n.y === edge.y1)?.node;
      const targetNode = nodes.find((n) => n.x === edge.x2 && n.y === edge.y2)?.node;
      edge.current =
        sourceNode && targetNode && currentPath.has(sourceNode) && currentPath.has(targetNode);
    }

    return { nodes, edges };
  }

  function handleClick(e) {
    const rect = containerEl.getBoundingClientRect();
    const clickX = e.clientX - rect.left + cameraX;
    const clickY = e.clientY - rect.top + cameraY;

    const gridX = clickX / GRID;
    const gridY = clickY / GRID;

    let closest = null;
    let closestDist = Infinity;

    for (const n of layoutData.nodes) {
      const dx = n.x - gridX;
      const dy = n.y - gridY;
      const dist = dx * dx + dy * dy;
      if (dist < closestDist && dist < 1) {
        closest = n.node;
        closestDist = dist;
      }
    }

    if (closest) {
      onSelectNode?.(closest);
    }
  }

  function remeasure() {
    if (!containerEl) return;
    svgWidth = containerEl.clientWidth;
    svgHeight = containerEl.clientHeight;
  }

  onMount(() => {
    remeasure();
    const observer = new ResizeObserver(() => remeasure());
    observer.observe(containerEl);
    containerEl.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      observer.disconnect();
      containerEl.removeEventListener('wheel', handleWheel);
    };
  });

  let dragging = $state(false);

  function handleMouseDown(e) {
    if (e.button === 0) dragging = true;
  }

  function handleMouseMove(e) {
    if (!dragging) return;
    cameraX -= e.movementX;
    cameraY -= e.movementY;
  }

  function handleMouseUp() {
    dragging = false;
  }

  function handleWheel(e) {
    e.preventDefault();
    if (e.deltaY < 0 && currentNode?.parent) {
      onSelectNode?.(currentNode.parent);
    } else if (e.deltaY > 0 && currentNode?.children.length > 0) {
      onSelectNode?.(currentNode.children[0]);
    }
  }
</script>

<svelte:window onmouseup={handleMouseUp} onmousemove={handleMouseMove} />

<div
  class="game-graph"
  bind:this={containerEl}
  role="img"
  aria-label="Game tree"
  onclick={handleClick}
  onmousedown={handleMouseDown}
>
  {#if moveNum !== null}
    <span class="move-num">{moveNum}</span>
  {/if}
  {#if svgWidth > 0 && svgHeight > 0}
    <svg width={svgWidth} height={svgHeight}>
      <g transform="translate({-cameraX}, {-cameraY})">
        {#each layoutData.edges as edge}
          {@const x1 = edge.x1 * GRID}
          {@const y1 = edge.y1 * GRID}
          {@const x2 = edge.x2 * GRID}
          {@const y2 = edge.y2 * GRID}
          {#if x1 === x2}
            <line
              {x1}
              {y1}
              {x2}
              {y2}
              stroke={edge.current ? '#ccc' : '#555'}
              stroke-width={edge.current ? 2 : 1}
            />
          {:else}
            <polyline
              points="{x1},{y1} {x2 - GRID},{y2 - GRID} {x2},{y2}"
              fill="none"
              stroke={edge.current ? '#ccc' : '#555'}
              stroke-width={edge.current ? 2 : 1}
            />
          {/if}
        {/each}

        {#each layoutData.nodes as n}
          {@const cx = n.x * GRID}
          {@const cy = n.y * GRID}
          {@const isCurrent = n.node === currentNode}
          {@const fill = n.hasBookmark
            ? 'var(--c-secondary)'
            : n.hasComment
              ? 'rgb(255, 174, 61)'
              : 'rgb(200, 200, 200)'}
          {#if n.isPass}
            <rect
              x={cx - NODE_RADIUS}
              y={cy - NODE_RADIUS}
              width={NODE_RADIUS * 2}
              height={NODE_RADIUS * 2}
              {fill}
              stroke={isCurrent ? 'var(--c-primary)' : 'none'}
              stroke-width={isCurrent ? 2 : 0}
            />
          {:else}
            <circle
              {cx}
              {cy}
              r={NODE_RADIUS}
              {fill}
              stroke={isCurrent ? 'var(--c-primary)' : 'none'}
              stroke-width={isCurrent ? 2 : 0}
            />
          {/if}
        {/each}
      </g>
    </svg>
  {/if}
</div>

<style>
  .game-graph {
    flex: 1 1 0;
    min-height: 80px;
    overflow: hidden;
    cursor: grab;
    background: var(--c-bg-low, var(--c-bg-box));
    border-top: 1px solid var(--c-border);
    user-select: none;
    position: relative;
  }

  .move-num {
    position: absolute;
    bottom: 4px;
    right: 6px;
    font-size: 0.75em;
    color: var(--c-font-dim, #888);
    pointer-events: none;
    z-index: 1;
  }

  .game-graph:active {
    cursor: grabbing;
  }

  .game-graph svg {
    display: block;
  }
</style>
