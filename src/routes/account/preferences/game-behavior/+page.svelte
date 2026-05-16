<script>
  import { boardSettings } from '$lib/nav/boardSettings.svelte.js';
</script>

<div class="box__top">
  <h1>Game behavior</h1>
</div>

<div class="game-behavior-settings">
  <section>
    <a href="#ctrlClick"><h2 id="ctrlClick">Ctrl+click on board coordinate</h2></a>
    <group class="radio">
      <div>
        <input
          id="ctrl-nothing"
          type="radio"
          name="ctrlClick"
          value="nothing"
          checked={boardSettings.ctrlClickBehavior === 'nothing'}
          onchange={() => boardSettings.setCtrlClickBehavior('nothing')}
        />
        <label for="ctrl-nothing">Nothing</label>
      </div>
      <div>
        <input
          id="ctrl-clipboard"
          type="radio"
          name="ctrlClick"
          value="clipboard"
          checked={boardSettings.ctrlClickBehavior === 'clipboard'}
          onchange={() => boardSettings.setCtrlClickBehavior('clipboard')}
        />
        <label for="ctrl-clipboard">Copy to clipboard</label>
      </div>
      <div>
        <input
          id="ctrl-chat"
          type="radio"
          name="ctrlClick"
          value="chat"
          checked={boardSettings.ctrlClickBehavior === 'chat'}
          onchange={() => boardSettings.setCtrlClickBehavior('chat')}
        />
        <label for="ctrl-chat">Paste into chat</label>
      </div>
    </group>
  </section>
</div>

<style>
  .game-behavior-settings section {
    padding: 1rem 0;
    border-bottom: 1px solid var(--c-border);
  }

  .game-behavior-settings section:first-child {
    border-top: 1px solid var(--c-border);
  }

  .game-behavior-settings h2 {
    font-size: 1rem;
    margin: 0 0 0.75rem;
  }

  .game-behavior-settings a {
    color: inherit;
    text-decoration: none;
  }

  .game-behavior-settings a:hover h2 {
    text-decoration: underline;
  }
</style>
