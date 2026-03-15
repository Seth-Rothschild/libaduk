<script>
	let { color, name, captures = 0, position = 'top', active = false } = $props();
</script>

<div class="ruser ruser-{position} color-icon is {color}" class:active>
	<i class="line"></i>
	<name>{name}</name>
	{#if captures > 0}
		<span class="material">+{captures}</span>
	{/if}
</div>
