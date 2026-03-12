<script>
	let { signMap, size = 19, lastMove = null, shiftMap = null, animatedVertex = null, onVertexClick } =
		$props();

	const vertexSize = 24;
	const half = vertexSize / 2;
	const fl = Math.floor;

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

	function handleClick(e) {
		const vertex = e.target.closest('.go-vertex');
		if (!vertex) return;
		const x = parseInt(vertex.dataset.x);
		const y = parseInt(vertex.dataset.y);
		onVertexClick?.(x, y);
	}
</script>

<div
	class="go-goban go-goban-image"
	style="display: inline-grid; font-size: {vertexSize}px; line-height: 1em;"
	onclick={handleClick}
	role="grid"
	aria-label="Go board"
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
							<div class="go-stone" style="position: absolute; z-index: 2;">
								<div class="go-inner go-sign_{sign}"></div>
								{#if isLast}
									<svg class="go-last-marker" viewBox="0 0 1 1">
										<circle
											cx="0.5"
											cy="0.5"
											r="0.18"
											class="go-last-marker-dot go-last-marker-dot_{sign}"
										/>
									</svg>
								{/if}
							</div>
						{/if}
					</div>
				{/each}
			{/each}
		</div>
	</div>
</div>
