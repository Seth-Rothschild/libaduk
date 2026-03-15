<script>
	let {
		signMap,
		size = 19,
		vertexSize = 24,
		lastMove = null,
		shiftMap = null,
		animatedVertex = null,
		onVertexClick,
		areaMap = null,
		deadStones = null,
		showCoords = false,
		currentSign = 1,
		markerMap = null,
		childrenMap = null
	} = $props();
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
	const boardSize = $derived(Math.round((size + 0.8) * vertexSize));

	const colLabels = $derived(COL_LETTERS.slice(0, size).split(''));
	const rowLabels = $derived(Array.from({ length: size }, (_, i) => size - i));

	const coordFontSize = $derived(Math.max(8, Math.round(vertexSize * 0.38)));
	const coordOffset = $derived(half * 0.35);

	const deadSet = $derived(
		deadStones ? new Set(deadStones.map(([x, y]) => `${x},${y}`)) : new Set()
	);

	function handleClick(e) {
		const vertex = e.target.closest('.go-vertex');
		if (!vertex) return;
		const x = parseInt(vertex.dataset.x);
		const y = parseInt(vertex.dataset.y);
		onVertexClick?.(x, y);
	}
</script>

<div
	style="display: inline-grid; grid-template-columns: {boardSize}px; grid-template-rows: {boardSize}px; font-size: {vertexSize}px;"
>
	<div
		class="go-goban go-goban-image"
		class:go-turn-black={currentSign === 1}
		class:go-turn-white={currentSign === -1}
		style="display: inline-grid; line-height: 1em;"
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
					<rect class="go-gridline" x={line.x} y={line.y} width={line.width} height={line.height} />
				{/each}
				{#each vLines as line}
					<rect class="go-gridline" x={line.x} y={line.y} width={line.width} height={line.height} />
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
					style="position: absolute; top: 0; left: 0; z-index: 0; pointer-events: none;"
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
									<div class="go-inner go-sign_{sign}"></div>
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
									<line x1="0.25" y1="0.25" x2="0.75" y2="0.75" class="go-marker-shape go-marker-on-{sign || 'empty'}" />
									<line x1="0.75" y1="0.25" x2="0.25" y2="0.75" class="go-marker-shape go-marker-on-{sign || 'empty'}" />
								</svg>
							{:else if marker === 'circle'}
								<svg class="go-marker" viewBox="0 0 1 1">
									<circle cx="0.5" cy="0.5" r="0.22" class="go-marker-shape go-marker-on-{sign || 'empty'}" />
								</svg>
							{:else if marker === 'square'}
								<svg class="go-marker" viewBox="0 0 1 1">
									<rect x="0.25" y="0.25" width="0.5" height="0.5" class="go-marker-shape go-marker-on-{sign || 'empty'}" />
								</svg>
							{/if}
							{#if sign === 0 && childSign !== 0}
								<div class="go-ghost go-ghost-{childSign}"></div>
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
						</div>
					{/each}
				{/each}
			</div>
		</div>
	</div>
</div>

<style>
	.go-coord-text {
		fill: var(--go-board-foreground-color, #5e2e0c);
		user-select: none;
		font-family: sans-serif;
	}

	.go-stone.go-dead :global(.go-inner) {
		opacity: 0.35;
	}

	.go-dead-x {
		position: absolute;
		top: 0;
		left: 0;
		width: 1em;
		height: 1em;
		z-index: 3;
	}

	.go-dead-x line {
		stroke: #e44;
	}

	.go-territory {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: 0.36em;
		height: 0.36em;
		z-index: 2;
	}

	.go-territory-black {
		background: #111;
	}

	.go-territory-white {
		background: #eee;
		outline: 1px solid #777;
	}

	.go-marker {
		position: absolute;
		top: 0;
		left: 0;
		width: 1em;
		height: 1em;
		z-index: 3;
		pointer-events: none;
	}

	.go-marker-empty {
		z-index: 2;
	}

	.go-marker-shape {
		fill: none;
		stroke-width: 0.07;
		stroke-linejoin: round;
		stroke-linecap: round;
	}

	.go-marker-on-1 {
		stroke: #eee;
	}

	.go-marker-on--1 {
		stroke: #222;
	}

	.go-marker-on-empty {
		stroke: #333;
	}

	.go-ghost {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: 0.4em;
		height: 0.4em;
		border-radius: 50%;
		z-index: 2;
		opacity: 0.5;
		pointer-events: none;
	}

	.go-ghost-1 {
		background: #111;
	}

	.go-ghost--1 {
		background: #ddd;
		box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.2);
	}
</style>
