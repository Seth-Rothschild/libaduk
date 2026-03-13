<script>
	let { clock, label, custom = false, onClick } = $props();
</script>

<div
	class="lpool"
	class:lpool--custom={custom}
	role="button"
	tabindex="0"
	onclick={() => onClick?.()}
	onkeydown={(e) => e.key === 'Enter' && onClick?.()}
>
	<span class="clock">{clock}</span>
	{#if label}
		<span class="perf">{label}</span>
	{/if}
</div>
