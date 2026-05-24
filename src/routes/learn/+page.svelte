<script>
  import { onMount } from 'svelte';
  import './learn.css';
  import { stages, categories } from './stages.js';
  import { readProgress, clearProgress } from './progress.js';

  let progress = $state({});

  onMount(() => {
    progress = readProgress();
  });

  function resetProgress() {
    clearProgress();
    progress = {};
  }

  const learnStages = stages.filter((s) => s.category !== 'what_next');
  const totalLessons = learnStages.reduce((sum, s) => sum + s.lessons.length, 0);

  const completedLessons = $derived(
    learnStages.reduce((sum, s) => sum + Math.min(progress[s.id] ?? 0, s.lessons.length), 0)
  );

  const progressPct = $derived(
    totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0
  );

  function stagesForCategory(categoryId) {
    return stages.filter((s) => s.category === categoryId);
  }

  function stageState(stage) {
    const category = categories.find((c) => c.id === stage.category);
    if (category.static) return 'done';
    const completed = progress[stage.id] ?? 0;
    if (stage.lessons.length > 0 && completed >= stage.lessons.length) return 'done';
    const stageIndex = learnStages.findIndex((s) => s.id === stage.id);
    const prev = learnStages[stageIndex - 1];
    const prevDone =
      prev == null || (prev.lessons.length > 0 && (progress[prev.id] ?? 0) >= prev.lessons.length);
    if (completed > 0 || prevDone) return 'ongoing';
    return 'future';
  }

  function ribbonText(stage) {
    const completed = progress[stage.id] ?? 0;
    if (completed > 0) return `${completed} / ${stage.lessons.length}`;
    return 'play!';
  }
</script>

<main id="learn-app">
  <div class="learn learn--map">
    <div class="learn__side">
      <div class="learn__side-home">
        <div class="learn__side-home__header">
          <img class="decoration" alt="" src="/images/learn/graduate-cap.svg" />
          <div class="learn__side-home__title">
            <h1>Learn Go</h1>
            <h2>by playing!</h2>
          </div>
        </div>
        <div class="progress">
          <div class="text">Progress: {progressPct}%</div>
          <div class="bar" style="width: {progressPct}%;"></div>
        </div>
        <div class="actions">
          <a class="confirm" onclick={resetProgress}>Reset my progress</a>
        </div>
      </div>
    </div>
    <div class="learn__main learn-stages">
      {#each categories as category}
        <div class="categ {category.id === 'what_next' ? 'what_next' : ''}">
          <h2>{category.title}</h2>
          {#if category.description}
            <p>{category.description}</p>
          {/if}
          <div class="categ_stages">
            {#each stagesForCategory(category.id) as stage}
              {@const state = stageState(stage)}
              <a class="stage {state}" href={stage.href ?? `/learn/${stage.id}`}>
                {#if state === 'done' && !category.static}
                  <span class="ribbon-wrapper">
                    <span class="ribbon done">
                      <icon data-icon="&#xe052;"></icon><icon data-icon="&#xe052;"></icon><icon
                        data-icon="&#xe052;"
                      ></icon>
                    </span>
                  </span>
                {:else if state === 'ongoing'}
                  <span class="ribbon-wrapper">
                    <span class="ribbon ongoing">{ribbonText(stage)}</span>
                  </span>
                {/if}
                <img src={stage.image} alt="" />
                <div class="text">
                  <h3>{stage.title}</h3>
                  <p class="subtitle">{stage.subtitle}</p>
                </div>
                {#if state === 'ongoing'}
                  <div class="attention-effect"></div>
                {/if}
              </a>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  </div>
</main>
