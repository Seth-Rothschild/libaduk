<script>
	const TABS = [
		{ id: 'pools', label: 'Quick pairing' },
		{ id: 'lobby', label: 'Lobby' },
		{ id: 'correspondence', label: 'Correspondence' }
	];

	let { activeTab = 'pools', onTabChange } = $props();
</script>

<div class="tabs-horiz">
	{#each TABS as tab}
		<button class:active={activeTab === tab.id} onclick={() => onTabChange?.(tab.id)}>
			{tab.label}
		</button>
	{/each}
</div>
