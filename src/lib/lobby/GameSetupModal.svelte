<script>
  import { goto } from '$app/navigation';

  let { gameType, onClose, creatorName = null } = $props();

  let dialog = $state(null);
  let timeMode = $state('byoyomi');
  let boardSize = $state(19);
  let color = $state('random');
  let loading = $state(false);
  let aiDifficulty = $state(4);
  let handicap = $state(0);
  let komi = $state(6.5);

  function onHandicapChange(stones) {
    handicap = stones;
    komi = stones > 0 ? 0.5 : 6.5;
  }

  const isAi = $derived(gameType === 'ai');

  // Byo-yomi sliders
  let byoMin = $state(10);
  let byoPeriods = $state(3);
  let byoSec = $state(20);

  // Fischer sliders
  let fischerMin = $state(20);
  let fischerInc = $state(0);

  // Correspondence preset
  let corrDays = $state(3);

  $effect(() => {
    dialog?.showModal();
  });

  const BYOYOMI_BY_SIZE = {
    9: [
      { label: '0+3×10s', min: 0, periods: 3, sec: 10 },
      { label: '0+3×20s', min: 0, periods: 3, sec: 20 },
      { label: '3+3×15s', min: 3, periods: 3, sec: 15 },
      { label: '5+3×20s', min: 5, periods: 3, sec: 20 },
      { label: '10+3×20s', min: 10, periods: 3, sec: 20 }
    ],
    13: [
      { label: '0+3×15s', min: 0, periods: 3, sec: 15 },
      { label: '1+3×20s', min: 1, periods: 3, sec: 20 },
      { label: '5+3×20s', min: 5, periods: 3, sec: 20 },
      { label: '10+3×25s', min: 10, periods: 3, sec: 25 },
      { label: '20+3×30s', min: 20, periods: 3, sec: 30 }
    ],
    19: [
      { label: '1+3×20s', min: 1, periods: 3, sec: 20 },
      { label: '5+3×20s', min: 5, periods: 3, sec: 20 },
      { label: '10+3×20s', min: 10, periods: 3, sec: 20 },
      { label: '20+3×30s', min: 20, periods: 3, sec: 30 },
      { label: '45+3×30s', min: 45, periods: 3, sec: 30 }
    ]
  };

  const FISCHER_BY_SIZE = {
    9: [
      { label: '2+0', min: 2, inc: 0 },
      { label: '5+0', min: 5, inc: 0 },
      { label: '10+0', min: 10, inc: 0 },
      { label: '15+0', min: 15, inc: 0 },
      { label: '20+0', min: 20, inc: 0 }
    ],
    13: [
      { label: '3+0', min: 3, inc: 0 },
      { label: '10+0', min: 10, inc: 0 },
      { label: '15+0', min: 15, inc: 0 },
      { label: '25+0', min: 25, inc: 0 },
      { label: '35+0', min: 35, inc: 0 }
    ],
    19: [
      { label: '5+0', min: 5, inc: 0 },
      { label: '10+0', min: 10, inc: 0 },
      { label: '20+0', min: 20, inc: 0 },
      { label: '30+0', min: 30, inc: 0 },
      { label: '45+0', min: 45, inc: 0 }
    ]
  };

  let byoyomiPresets = $derived(BYOYOMI_BY_SIZE[boardSize]);
  let fischerPresets = $derived(FISCHER_BY_SIZE[boardSize]);

  const CORR_PRESETS = [1, 3, 7, 14];
  const SIZE_OPTIONS = [9, 13, 19];

  const BYO_DEFAULTS = {
    9: { min: 3, periods: 3, sec: 15 },
    13: { min: 5, periods: 3, sec: 20 },
    19: { min: 10, periods: 3, sec: 20 }
  };
  const FISCHER_DEFAULTS = {
    9: { min: 5, inc: 0 },
    13: { min: 10, inc: 0 },
    19: { min: 20, inc: 0 }
  };

  const BUTTON_LABELS = {
    hook: 'Create a game',
    friend: 'Challenge a friend',
    ai: 'Play against computer'
  };

  function applyByoDefaults() {
    let d = BYO_DEFAULTS[boardSize];
    byoMin = d.min;
    byoPeriods = d.periods;
    byoSec = d.sec;
  }

  function applyFischerDefaults() {
    let d = FISCHER_DEFAULTS[boardSize];
    fischerMin = d.min;
    fischerInc = d.inc;
  }

  function switchTimeMode(mode) {
    timeMode = mode;
    if (mode === 'byoyomi') applyByoDefaults();
    else if (mode === 'realtime') applyFischerDefaults();
    else if (mode === 'correspondence') corrDays = 3;
  }

  function switchBoardSize(size) {
    boardSize = size;
    if (timeMode === 'byoyomi') applyByoDefaults();
    else if (timeMode === 'realtime') applyFischerDefaults();
  }

  function buildTimeControl() {
    if (timeMode === 'unlimited') return { type: 'none' };
    if (timeMode === 'correspondence') return { type: 'correspondence', days: corrDays };
    if (timeMode === 'byoyomi')
      return { type: 'byoyomi', initial: byoMin * 60, periods: byoPeriods, periodTime: byoSec };
    return { type: 'fischer', initial: fischerMin * 60, increment: fischerInc };
  }

  async function submit() {
    loading = true;
    try {
      const timeControl = buildTimeControl();
      const body = { size: boardSize, timeControl, color, gameType, creatorName, komi, handicap };
      if (isAi) {
        body.aiDifficulty = aiDifficulty;
      }
      const res = await fetch('/api/game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const { gameId } = await res.json();
      onClose();
      goto(`/play/${gameId}`);
    } catch {
      loading = false;
    }
  }

  function close() {
    dialog?.close();
    onClose();
  }

  function onDialogClick(e) {
    if (e.target === e.currentTarget) close();
  }

  function corrLabel(days) {
    return days === 1 ? '1 day' : `${days} days`;
  }
</script>

<dialog bind:this={dialog} class="game-setup" onclose={onClose} onclick={onDialogClick}>
  <div class="scrollable">
    <div class="close-button-anchor">
      <button class="close-button" data-icon="" onclick={close} aria-label="Close"></button>
    </div>

    <h2>Game Setup</h2>

    <div class="setup-content">
      <!-- Board size -->
      <div class="config-group">
        <div class="label">Board size</div>
        <div class="size-choices">
          {#each SIZE_OPTIONS as size}
            <button
              class="size-choice"
              class:active={boardSize === size}
              onclick={() => switchBoardSize(size)}
            >
              {size}×{size}
            </button>
          {/each}
        </div>
      </div>

      <!-- Time control -->
      <div class="config-group time-control-tabs">
        <div class="tabs-horiz">
          <button class:active={timeMode === 'byoyomi'} onclick={() => switchTimeMode('byoyomi')}>
            Byo-yomi
          </button>
          <button class:active={timeMode === 'realtime'} onclick={() => switchTimeMode('realtime')}>
            Fischer
          </button>
          <button
            class:active={timeMode === 'correspondence'}
            onclick={() => switchTimeMode('correspondence')}
          >
            Correspondence
          </button>
          <button
            class:active={timeMode === 'unlimited'}
            onclick={() => switchTimeMode('unlimited')}
          >
            Unlimited
          </button>
        </div>

        {#if timeMode === 'byoyomi'}
          <div class="time-panel">
            <div class="sliders">
              <div class="slider-row">
                <label class="slider-label" for="byo-min">Minutes per side</label>
                <input
                  id="byo-min"
                  class="range"
                  type="range"
                  min="0"
                  max="60"
                  value={byoMin}
                  oninput={(e) => (byoMin = +e.target.value)}
                />
                <span class="val-box">{byoMin}</span>
              </div>
              <div class="slider-row">
                <label class="slider-label" for="byo-periods">Byo-yomi periods</label>
                <input
                  id="byo-periods"
                  class="range"
                  type="range"
                  min="1"
                  max="10"
                  value={byoPeriods}
                  oninput={(e) => (byoPeriods = +e.target.value)}
                />
                <span class="val-box">{byoPeriods}</span>
              </div>
              <div class="slider-row">
                <label class="slider-label" for="byo-sec">Period time (seconds)</label>
                <input
                  id="byo-sec"
                  class="range"
                  type="range"
                  min="5"
                  max="120"
                  step="5"
                  value={byoSec}
                  oninput={(e) => (byoSec = +e.target.value)}
                />
                <span class="val-box">{byoSec}s</span>
              </div>
            </div>
            <div class="presets">
              {#each byoyomiPresets as p}
                <button
                  class="preset-btn"
                  class:active={byoMin === p.min && byoPeriods === p.periods && byoSec === p.sec}
                  onclick={() => {
                    byoMin = p.min;
                    byoPeriods = p.periods;
                    byoSec = p.sec;
                  }}
                >
                  {p.label}
                </button>
              {/each}
            </div>
          </div>
        {:else if timeMode === 'realtime'}
          <div class="time-panel">
            <div class="sliders-grid">
              <div class="slider-container">
                <div class="label-row">
                  <label for="fischer-min">Minutes per side</label>
                  <span class="val-box">{fischerMin}</span>
                </div>
                <input
                  id="fischer-min"
                  class="range"
                  type="range"
                  min="1"
                  max="60"
                  value={fischerMin}
                  oninput={(e) => (fischerMin = +e.target.value)}
                />
              </div>
              <div class="slider-separator">+</div>
              <div class="slider-container">
                <div class="label-row">
                  <span class="val-box">{fischerInc}s</span>
                  <label for="fischer-inc">Increment (seconds)</label>
                </div>
                <input
                  id="fischer-inc"
                  class="range"
                  type="range"
                  min="0"
                  max="60"
                  value={fischerInc}
                  oninput={(e) => (fischerInc = +e.target.value)}
                />
              </div>
            </div>
            <div class="presets">
              {#each fischerPresets as p}
                <button
                  class="preset-btn"
                  class:active={fischerMin === p.min && fischerInc === p.inc}
                  onclick={() => {
                    fischerMin = p.min;
                    fischerInc = p.inc;
                  }}
                >
                  {p.label}
                </button>
              {/each}
            </div>
          </div>
        {:else if timeMode === 'correspondence'}
          <div class="time-panel">
            <div class="slider-container">
              <div class="label-row">
                <label for="corr-days">Days per turn</label>
                <span class="val-box">{corrLabel(corrDays)}</span>
              </div>
              <input
                id="corr-days"
                class="range"
                type="range"
                min="1"
                max="14"
                value={corrDays}
                oninput={(e) => (corrDays = +e.target.value)}
              />
            </div>
            <div class="presets">
              {#each CORR_PRESETS as days}
                <button
                  class="preset-btn"
                  class:active={corrDays === days}
                  onclick={() => (corrDays = days)}
                >
                  {corrLabel(days)}
                </button>
              {/each}
            </div>
          </div>
        {:else}
          <div class="time-panel">
            <p class="unlimited-label">No time limit</p>
          </div>
        {/if}
      </div>
      {#if isAi}
        <div class="config-group">
          <div class="label" style="text-align: center;">Strength</div>
          <group class="radio ai-strength">
            {#each [1, 2, 3, 4, 5, 6, 7, 8] as level}
              <div>
                <input
                  id="sf_level_{level}"
                  name="level"
                  type="radio"
                  value={level}
                  checked={aiDifficulty === level}
                  onchange={() => (aiDifficulty = level)}
                />
                <label for="sf_level_{level}">{level}</label>
              </div>
            {/each}
          </group>
        </div>
      {/if}
      <!-- Handicap -->
      <div class="config-group">
        <div class="label" style="text-align: center;">Handicap</div>
        <group class="radio ai-strength">
          {#each [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as stones}
            <div>
              <input
                id="hc_{stones}"
                name="handicap"
                type="radio"
                value={stones}
                checked={handicap === stones}
                onchange={() => onHandicapChange(stones)}
              />
              <label for="hc_{stones}">{stones}</label>
            </div>
          {/each}
        </group>
      </div>

      <!-- Color picker -->
      <div class="config-group">
        <div class="label">Side</div>
        <div class="color-choices">
          {#each [['black', 'Black'], ['random', 'Random'], ['white', 'White']] as [key, name]}
            <button class="color-choice" class:active={color === key} onclick={() => (color = key)}>
              <div class="color-picker__button {key}"><i></i></div>
              <span class="text">{name}</span>
            </button>
          {/each}
        </div>
      </div>
    </div>

    <div class="footer">
      <button
        class="button button-metal lobby__start__button lobby__start__button--{gameType}"
        onclick={submit}
        disabled={loading}
        class:disabled={loading}
      >
        {BUTTON_LABELS[gameType]}
      </button>
      {#if loading}
        <div class="spinner"></div>
      {/if}
    </div>
  </div>
</dialog>
