<script>
  import { goto } from '$app/navigation';
  import { getMe } from '$lib/state/user.svelte.js';
  import {
    createBoard,
    parseSgf,
    applySetup,
    sgfNodeToMove,
    sgfNodeMarkers,
    sgfNodeComment,
    sgfNodeSetup
  } from '$lib/game/board';
  import {
    makeAnalysisNode,
    getAnalysisMoveName,
    serializeTree
  } from '$lib/game/analysisState.svelte.js';

  let sgfText = $state('');
  let fileInputEl;
  let error = $state('');
  let loading = $state(false);

  function buildTree(parsed) {
    const size = parsed.size;

    function buildNode(sgfNode, board, signToPlay, parent) {
      const move = sgfNodeToMove(sgfNode);
      let newBoard = board;
      let lastMove = null;
      let moveName = null;
      let nextSign = signToPlay;

      if (move && move.type === 'move') {
        try {
          newBoard = board.makeMove(move.sign, [move.x, move.y], {
            preventSuicide: true,
            preventOverwrite: true,
            preventKo: true
          });
          lastMove = [move.x, move.y];
          moveName = getAnalysisMoveName(board, move.sign, lastMove);
          nextSign = move.sign === 1 ? -1 : 1;
        } catch {
          return null;
        }
      }

      const setup = sgfNodeSetup(sgfNode, size);
      newBoard = applySetup(newBoard, setup);
      const markers = sgfNodeMarkers(sgfNode, size);
      const comment = sgfNodeComment(sgfNode);
      const node = makeAnalysisNode(
        newBoard,
        lastMove,
        markers,
        nextSign,
        parent,
        moveName,
        comment,
        setup
      );

      for (const childSgf of sgfNode.children) {
        const childNode = buildNode(childSgf, newBoard, nextSign, node);
        if (childNode) node.children.push(childNode);
      }

      return node;
    }

    return buildNode(parsed.root, createBoard(size), 1, null);
  }

  function extractMoves(root) {
    const moves = [];
    let node = root;
    while (node.children.length > 0) {
      node = node.children[0];
      if (node.lastMove) {
        moves.push({ type: 'move', x: node.lastMove[0], y: node.lastMove[1] });
      }
    }
    return moves;
  }

  async function importSgf(text) {
    const parsed = parseSgf(text);
    if (!parsed) {
      error = 'Could not parse SGF. Please check that the file is valid.';
      return;
    }

    const root = buildTree(parsed);
    if (!root) {
      error = 'Could not build game tree from SGF.';
      return;
    }

    const moves = extractMoves(root);
    const analysisTree = serializeTree(root);

    const response = await fetch('/api/game/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        moves,
        analysisTree,
        blackName: parsed.playerBlack || 'Black',
        whiteName: parsed.playerWhite || 'White',
        size: parsed.size,
        komi: 6.5,
        username: getMe()?.username ?? null
      })
    });

    if (!response.ok) {
      error = 'Failed to save game. Please try again.';
      return;
    }

    const { id } = await response.json();
    goto(`/play/${id}`);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    error = '';
    loading = true;
    try {
      if (sgfText.trim()) {
        await importSgf(sgfText.trim());
      } else {
        error = 'Please paste an SGF or upload a file.';
      }
    } finally {
      loading = false;
    }
  }

  function handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      sgfText = reader.result.replace(/\r?\n/g, '');
    };
    reader.readAsText(file);
  }
</script>

<main class="importer page-small box box-pad">
  <h1 class="box__top">Import game</h1>
  <p class="explanation">
    Upload an SGF to get a browsable replay, game chat, and a shareable link.
  </p>
  <form class="form3 import" onsubmit={handleSubmit}>
    <div class="form-group">
      <label class="form-label" for="sgf-text">Paste the SGF text here</label>
      <textarea id="sgf-text" class="form-control" bind:value={sgfText}></textarea>
    </div>
    <div class="form-group upload">
      <label class="form-label" for="sgf-file">Or upload an SGF file</label>
      <input
        id="sgf-file"
        type="file"
        accept=".sgf"
        bind:this={fileInputEl}
        onchange={handleFileChange}
      />
    </div>
    {#if error}
      <div class="form-error">{error}</div>
    {/if}
    <div class="form-actions single">
      <button type="submit" class="submit button" disabled={!sgfText.trim() || loading}>
        {loading ? 'Importing...' : 'Import game'}
      </button>
    </div>
  </form>
</main>

<style>
  textarea {
    width: 98%;
    height: 20vh !important;
    padding: 0.5em;
  }
</style>
