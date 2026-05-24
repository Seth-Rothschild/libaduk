<script>
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { dev } from '$app/environment';
  import '../learn.css';
  import { stages, categories } from '../stages.js';
  import { readProgress, completeLesson } from '../progress.js';
  import GoBoard from '$lib/game/GoBoard.svelte';

  const stageId = $derived($page.params.stageId);
  const stage = $derived(stages.find((s) => s.id === stageId));

  let progress = $state({});

  onMount(() => {
    progress = readProgress();
  });

  const completedCount = $derived(progress[stageId] ?? 0);
  const currentLessonIndex = $derived(Math.min(completedCount, (stage?.lessons.length ?? 1) - 1));
  const currentLesson = $derived(stage?.lessons[currentLessonIndex]);
  const boardSize = $derived(currentLesson?.boardSize ?? 9);
  const playerSign = $derived(currentLesson?.turn === 'black' ? 1 : -1);
  const stageComplete = $derived(
    stage != null && completedCount >= stage.lessons.length && stage.lessons.length > 0
  );

  let signMap = $state([]);
  let moveIndex = $state(0);
  let lastMove = $state(null);
  let lessonFailed = $state(false);

  let dismissedStages = $state(new Set());
  const showScreen = $derived(!dismissedStages.has(stageId));

  function dismissScreen() {
    dismissedStages = new Set([...dismissedStages, stageId]);
  }

  function buildSignMap(lesson) {
    const map = Array.from({ length: lesson.boardSize }, () => Array(lesson.boardSize).fill(0));
    for (const [x, y] of lesson.initialStones?.black ?? []) map[y][x] = 1;
    for (const [x, y] of lesson.initialStones?.white ?? []) map[y][x] = -1;
    return map;
  }

  function placeStone(map, x, y, sign) {
    return map.map((row, ry) => row.map((cell, rx) => (rx === x && ry === y ? sign : cell)));
  }

  $effect(() => {
    if (currentLesson) {
      signMap = buildSignMap(currentLesson);
      moveIndex = 0;
      lastMove = null;
      lessonFailed = false;
    }
  });

  function signForMove(index) {
    return index % 2 === 0 ? playerSign : -playerSign;
  }

  function advance() {
    completeLesson(stageId, completedCount + 1);
    progress = readProgress();
  }

  function handleVertexClick(x, y) {
    if (!currentLesson || stageComplete || lessonFailed) return;
    if (currentLesson.solution.length === 0) return;

    const expected = currentLesson.solution[moveIndex];
    if (!expected || x !== expected[0] || y !== expected[1]) {
      lessonFailed = true;
      setTimeout(() => {
        signMap = buildSignMap(currentLesson);
        moveIndex = 0;
        lastMove = null;
        lessonFailed = false;
      }, 1000);
      return;
    }

    const moveSign = signForMove(moveIndex);
    signMap = placeStone(signMap, x, y, moveSign);
    lastMove = [x, y];
    moveIndex++;

    if (moveIndex >= currentLesson.solution.length) {
      advance();
      return;
    }

    const opponentMove = currentLesson.solution[moveIndex];
    const opponentSign = -moveSign;
    setTimeout(() => {
      signMap = placeStone(signMap, opponentMove[0], opponentMove[1], opponentSign);
      lastMove = opponentMove;
      moveIndex++;
      if (moveIndex >= currentLesson.solution.length) {
        advance();
      }
    }, 500);
  }

  const activeCategory = $derived(stage?.category);
  let expandedCategory = $state(null);
  const openCategory = $derived(expandedCategory ?? activeCategory);

  function stagesForCategory(categoryId) {
    return stages.filter((s) => s.category === categoryId);
  }

  function sidebarStageState(s) {
    if (s.id === stageId) return 'active';
    const completed = progress[s.id] ?? 0;
    if (completed >= s.lessons.length && s.lessons.length > 0) return 'done';
    if (completed > 0) return 'ongoing';
    return 'future';
  }

  function toggleCategory(categoryId) {
    expandedCategory = openCategory === categoryId ? null : categoryId;
  }
</script>

<main id="learn-app">
  <div class="learn learn--run">
    <div class="learn__side">
      <div class="learn__side-map">
        <div class="stages">
          <a class="back" href="/learn">
            <img alt="" src="/images/learn/graduate-cap.svg" />
            Menu
          </a>
          {#each categories.filter((c) => !c.static) as category}
            {@const isOpen = openCategory === category.id}
            <div class="categ" class:active={isOpen}>
              <h2 onclick={() => toggleCategory(category.id)}>{category.title}</h2>
              <div class="categ_stages">
                {#each stagesForCategory(category.id) as s}
                  <a class="stage {sidebarStageState(s)}" href="/learn/{s.id}">
                    <img src={s.image} alt="" />
                    <span>{s.title}</span>
                  </a>
                {/each}
              </div>
            </div>
          {/each}
        </div>
      </div>
    </div>

    <div class="learn__main main-board">
      {#if showScreen && stage && !stageComplete}
        <div class="learn__screen-overlay">
          <div class="learn__screen">
            <h1>{stage.title}</h1>
            <div class="no-square">
              <img src={stage.image} alt="" />
            </div>
            <p>{stage.description}</p>
            <div class="buttons">
              <button class="button" onclick={dismissScreen}>Let's go!</button>
            </div>
          </div>
        </div>
      {/if}
      {#if stageComplete}
        <div class="learn__screen-overlay">
          <div class="learn__screen">
            <h1>{stage.title} complete!</h1>
            <div class="no-square">
              <img src={stage.image} alt="" />
            </div>
            <div class="buttons">
              <a class="button" href="/learn">Back to menu</a>
            </div>
          </div>
        </div>
      {/if}
      <div class="learn-board" class:failed={lessonFailed}>
        <GoBoard
          {signMap}
          size={boardSize}
          {lastMove}
          currentSign={playerSign}
          onVertexClick={handleVertexClick}
        />
      </div>
    </div>

    <div class="learn__table">
      {#if stage}
        <div class="wrap">
          <div class="title">
            <img src={stage.image} alt="" />
            <div class="text">
              <h2>{stage.title}</h2>
              <p class="subtitle">{stage.subtitle}</p>
            </div>
          </div>
          <div class="goal">{currentLesson?.description ?? ''}</div>
          <div class="progress">
            {#each stage.lessons as lesson, i}
              {@const dotState =
                i < completedCount ? 'done' : i === currentLessonIndex ? 'active' : 'future'}
              <a class={dotState} href="/learn/{stageId}/{lesson.id}">
                <span class="id">{i + 1}</span>
              </a>
            {/each}
          </div>
          {#if dev && currentLesson?.solution.length === 0}
            <button onclick={advance}>Complete lesson (dev)</button>
          {/if}
        </div>
      {/if}
    </div>
  </div>
</main>
