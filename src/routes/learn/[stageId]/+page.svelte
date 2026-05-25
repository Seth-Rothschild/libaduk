<script>
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { dev } from '$app/environment';
  import influence from '@sabaki/influence';
  import '../learn.css';
  import { stages, categories } from '../stages.js';
  import { readProgress, completeLesson } from '../progress.js';
  import GoBoard from '$lib/game/GoBoard.svelte';
  import GoBoardLib from '@sabaki/go-board';

  const AFFIRMATIONS = [
    'Awesome!',
    'Excellent!',
    'Great job!',
    'Nailed it.',
    'Outstanding!',
    'Perfect!',
    'Right on!',
    'Way to go!',
    'Yes, yes, yes!',
    "You're good at this!"
  ];

  const stageId = $derived($page.params.stageId);
  const stage = $derived(stages.find((s) => s.id === stageId));

  let progress = $state({});

  onMount(() => {
    progress = readProgress();
  });

  const completedCount = $derived(progress[stageId] ?? 0);
  let selectedIndex = $state(null);
  const currentLessonIndex = $derived(
    selectedIndex ?? Math.min(completedCount, (stage?.lessons.length ?? 1) - 1)
  );
  const playableStages = stages.filter((s) => s.lessons?.length > 0);
  const nextStage = $derived.by(() => {
    const idx = playableStages.findIndex((s) => s.id === stageId);
    return idx >= 0 && idx < playableStages.length - 1 ? playableStages[idx + 1] : null;
  });
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
  let affirmation = $state(null);
  let passMessage = $state(null);

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
    return new GoBoardLib(map).makeMove(sign, [x, y]).signMap;
  }

  const markerMap = $derived.by(() => {
    if (lessonFailed || !currentLesson?.hints) return null;
    const hint = currentLesson.hints[moveIndex];
    if (!hint) return null;
    const map = Array.from({ length: boardSize }, () => Array(boardSize).fill(null));
    map[hint[1]][hint[0]] = 'hint';
    return map;
  });

  const hintIsPass = $derived.by(() => {
    if (lessonFailed || !currentLesson?.hints) return false;
    return moveIndex in currentLesson.hints && currentLesson.hints[moveIndex] === null;
  });

  const areaMap = $derived(currentLesson?.showScoring ? influence.areaMap(signMap) : null);

  $effect(() => {
    if (currentLesson) {
      signMap = buildSignMap(currentLesson);
      moveIndex = 0;
      lastMove = null;
      lessonFailed = false;
      passMessage = null;
    }
  });

  function signForMove(index) {
    return index % 2 === 0 ? playerSign : -playerSign;
  }

  function advance() {
    affirmation = AFFIRMATIONS[Math.floor(Math.random() * AFFIRMATIONS.length)];
    const wasReviewing = selectedIndex !== null;
    setTimeout(() => {
      affirmation = null;
      selectedIndex = null;
      if (!wasReviewing) {
        completeLesson(stageId, completedCount + 1);
        progress = readProgress();
      }
    }, 2000);
  }

  function jumpToLesson(i) {
    if (i <= completedCount) selectedIndex = i;
  }

  function handleVertexClick(x, y) {
    if (!currentLesson || stageComplete || lessonFailed) return;
    if (currentLesson.solution.length === 0) return;

    const expected = currentLesson.solution[moveIndex];
    if (!expected || x !== expected[0] || y !== expected[1]) {
      lessonFailed = true;
      setTimeout(() => {
        lessonFailed = false;
      }, 600);
      return;
    }

    passMessage = null;
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
      if (opponentMove !== null) {
        signMap = placeStone(signMap, opponentMove[0], opponentMove[1], opponentSign);
        lastMove = opponentMove;
      } else {
        passMessage = 'Opponent passed';
      }
      moveIndex++;
      if (moveIndex >= currentLesson.solution.length) {
        advance();
      }
    }, 500);
  }

  const lessonHasPass = $derived(currentLesson?.solution?.some((m) => m === null) ?? false);

  function handlePass() {
    if (!currentLesson || stageComplete || lessonFailed) return;
    const expected = currentLesson.solution[moveIndex];
    if (expected !== null) {
      lessonFailed = true;
      setTimeout(() => {
        lessonFailed = false;
      }, 600);
      return;
    }
    lastMove = null;
    passMessage = 'You passed';
    moveIndex++;
    if (moveIndex >= currentLesson.solution.length) {
      setTimeout(advance, 800);
      return;
    }
    const opponentMove = currentLesson.solution[moveIndex];
    const opponentSign = -signForMove(moveIndex - 1);
    setTimeout(() => {
      if (opponentMove !== null) {
        signMap = placeStone(signMap, opponentMove[0], opponentMove[1], opponentSign);
        lastMove = opponentMove;
        passMessage = null;
        moveIndex++;
        if (moveIndex >= currentLesson.solution.length) advance();
      } else {
        passMessage = 'Opponent passed';
        moveIndex++;
        if (moveIndex >= currentLesson.solution.length) setTimeout(advance, 800);
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

  let authorBoardSize = $state(9);
  let authorTurn = $state('black');
  let authorPhase = $state('setup');
  let authorSetupColor = $state(1);
  let authorSignMap = $state(Array.from({ length: 9 }, () => Array(9).fill(0)));
  let authorInitialSignMap = $state([]);
  let authorSolution = $state([]);
  let authorHints = $state({});
  let authorHintMode = $state(false);
  let authorDescription = $state('');
  let authorLastMove = $state(null);

  function initAuthorBoard() {
    authorSignMap = Array.from({ length: authorBoardSize }, () => Array(authorBoardSize).fill(0));
    authorInitialSignMap = [];
    authorSolution = [];
    authorHints = {};
    authorLastMove = null;
    authorPhase = 'setup';
    authorSetupColor = 1;
  }

  function switchToRecord() {
    authorInitialSignMap = authorSignMap.map((row) => [...row]);
    authorPhase = 'record';
    authorSolution = [];
    authorHints = {};
    authorLastMove = null;
  }

  function handleAuthorClick(x, y) {
    if (authorPhase === 'setup') {
      const current = authorSignMap[y][x];
      const next = current !== 0 ? 0 : authorSetupColor;
      if (current === 0) authorSetupColor = -authorSetupColor;
      authorSignMap = authorSignMap.map((row, ry) =>
        row.map((cell, rx) => (rx === x && ry === y ? next : cell))
      );
    } else if (authorHintMode) {
      authorHints = { ...authorHints, [authorSolution.length]: [x, y] };
      authorHintMode = false;
    } else {
      const turnSign = authorTurn === 'black' ? 1 : -1;
      const sign = authorSolution.length % 2 === 0 ? turnSign : -turnSign;
      authorSignMap = authorSignMap.map((row, ry) =>
        row.map((cell, rx) => (rx === x && ry === y ? sign : cell))
      );
      authorSolution = [...authorSolution, [x, y]];
      authorLastMove = [x, y];
    }
  }

  function undoAuthorMove() {
    if (authorSolution.length === 0) return;
    const newSolution = authorSolution.slice(0, -1);
    const turnSign = authorTurn === 'black' ? 1 : -1;
    let newMap = authorInitialSignMap.map((row) => [...row]);
    newSolution.forEach((move, i) => {
      const sign = i % 2 === 0 ? turnSign : -turnSign;
      newMap = newMap.map((row, ry) =>
        row.map((cell, rx) => (rx === move[0] && ry === move[1] ? sign : cell))
      );
    });
    authorSignMap = newMap;
    authorSolution = newSolution;
    authorLastMove = newSolution.length > 0 ? newSolution[newSolution.length - 1] : null;
    const newHints = {};
    for (const [k, v] of Object.entries(authorHints)) {
      if (parseInt(k) < newSolution.length) newHints[k] = v;
    }
    authorHints = newHints;
  }

  const authorMarkerMap = $derived.by(() => {
    if (Object.keys(authorHints).length === 0) return null;
    const map = Array.from({ length: authorBoardSize }, () => Array(authorBoardSize).fill(null));
    for (const pos of Object.values(authorHints)) {
      map[pos[1]][pos[0]] = 'hint';
    }
    return map;
  });

  const authorOutput = $derived.by(() => {
    const black = [];
    const white = [];
    const sourceMap = authorInitialSignMap.length ? authorInitialSignMap : authorSignMap;
    sourceMap.forEach((row, y) => {
      row.forEach((cell, x) => {
        if (cell === 1) black.push([x, y]);
        else if (cell === -1) white.push([x, y]);
      });
    });
    const move = ([x, y]) => `[${x},${y}]`;
    const moves = (arr) => arr.map(move).join(', ');
    const hintsStr =
      Object.keys(authorHints).length === 0
        ? '{}'
        : `{ ${Object.entries(authorHints)
            .map(([k, v]) => `${k}: ${move(v)}`)
            .join(', ')} }`;
    return `{
  description: ${JSON.stringify(authorDescription)},
  boardSize: ${authorBoardSize},
  initialStones: {
    black: [${moves(black)}],
    white: [${moves(white)}]
  },
  turn: '${authorTurn}',
  solution: [${moves(authorSolution)}],
  hints: ${hintsStr}
},`;
  });
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
            <div class="stars">
              <div class="star-wrap"><icon class="star"></icon></div>
              <div class="star-wrap"><icon class="star"></icon></div>
              <div class="star-wrap"><icon class="star"></icon></div>
            </div>
            <h1>{stage.title} complete</h1>
            <p>{stage.description}</p>
            <div class="buttons">
              {#if nextStage}
                <a class="button" href="/learn/{nextStage.id}">
                  Next: {nextStage.title}<icon data-icon=""></icon>
                </a>
              {/if}
              <a class="button button-empty" href="/learn">
                <icon data-icon=""></icon>Back to menu
              </a>
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
          {markerMap}
          {areaMap}
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
          <div
            class="goal"
            class:celebrating={!!affirmation}
            class:passing={!!passMessage && !affirmation}
          >
            {#if affirmation}
              <span class="affirmation">{affirmation}</span>
            {:else if passMessage}
              <span class="pass-message">{passMessage}</span>
            {:else}
              {currentLesson?.description ?? ''}
            {/if}
          </div>
          <div class="progress">
            {#each stage.lessons as lesson, i}
              {@const dotState =
                i < completedCount ? 'done' : i === currentLessonIndex ? 'active' : 'future'}
              <button class={dotState} onclick={() => jumpToLesson(i)}>
                <span class="id">{i + 1}</span>
              </button>
            {/each}
          </div>
          {#if lessonHasPass}
            <button
              class="button button-metal pass-btn"
              class:pass-hint={hintIsPass}
              onclick={handlePass}>Pass</button
            >
          {:else if currentLesson?.solution?.length === 0}
            <button class="button button-metal pass-btn" onclick={advance}>Got it</button>
          {/if}
        </div>
      {/if}
    </div>
  </div>
  {#if dev}
    <div class="author-panel">
      <h3>Lesson Author</h3>
      <div class="author-controls">
        <label>
          Board size:
          <input
            type="number"
            bind:value={authorBoardSize}
            min="5"
            max="19"
            onchange={initAuthorBoard}
          />
        </label>
        <label>
          Turn:
          <select bind:value={authorTurn}>
            <option value="black">Black</option>
            <option value="white">White</option>
          </select>
        </label>
        <label>
          Description:
          <input type="text" bind:value={authorDescription} />
        </label>
        <button onclick={initAuthorBoard}>Reset</button>
      </div>
      <div class="author-phase">
        {#if authorPhase === 'setup'}
          <strong>Setup:</strong> click to cycle empty → black → white → empty
          <button onclick={switchToRecord}>Done → Record moves</button>
        {:else}
          <strong>Record:</strong> move {authorSolution.length}
          <button onclick={() => (authorHintMode = !authorHintMode)} class:active={authorHintMode}>
            {authorHintMode ? 'Click board = hint' : 'Add hint'}
          </button>
          <button onclick={undoAuthorMove} disabled={authorSolution.length === 0}>Undo</button>
          <button
            onclick={() => {
              authorPhase = 'setup';
            }}>← Back to setup</button
          >
        {/if}
      </div>
      <div class="author-body">
        <div class="author-board">
          <GoBoard
            signMap={authorSignMap}
            size={authorBoardSize}
            lastMove={authorLastMove}
            currentSign={authorTurn === 'black' ? 1 : -1}
            onVertexClick={handleAuthorClick}
            markerMap={authorMarkerMap}
          />
        </div>
        <textarea class="author-output" readonly value={authorOutput}></textarea>
      </div>
    </div>
  {/if}
</main>
