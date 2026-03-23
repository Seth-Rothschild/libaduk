<script>
  let { canPrev = false, canNext = false, onFirst, onPrev, onNext, onLast } = $props();
</script>

<div class="rbuttons">
  <button
    class="fbt"
    data-icon="&#xe035;"
    disabled={!canPrev}
    onclick={onFirst}
    aria-label="First move"
  ></button>
  <button
    class="fbt"
    data-icon="&#xe037;"
    disabled={!canPrev}
    onclick={onPrev}
    aria-label="Previous move"
  ></button>
  <button
    class="fbt"
    data-icon="&#xe036;"
    disabled={!canNext}
    onclick={onNext}
    aria-label="Next move"
  ></button>
  <button
    class="fbt"
    data-icon="&#xe034;"
    disabled={!canNext}
    onclick={onLast}
    aria-label="Last move"
  ></button>
</div>
