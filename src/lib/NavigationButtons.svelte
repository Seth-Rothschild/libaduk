<script>
	let { canPrev = false, canNext = false, onFirst, onPrev, onNext, onLast } = $props();
</script>

<div class="rbuttons">
	<button class="fbt" data-icon="&#xe035;" disabled={!canPrev} onclick={onFirst}></button>
	<button class="fbt" data-icon="&#xe037;" disabled={!canPrev} onclick={onPrev}></button>
	<button class="fbt" data-icon="&#xe036;" disabled={!canNext} onclick={onNext}></button>
	<button class="fbt" data-icon="&#xe034;" disabled={!canNext} onclick={onLast}></button>
</div>
