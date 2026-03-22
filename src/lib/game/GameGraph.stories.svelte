<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import { expect, fn } from 'storybook/test';
  import GameGraph from './GameGraph.svelte';

  function makeNode(lastMove, parent, comment = '') {
    return {
      lastMove,
      parent,
      children: [],
      comment,
      signToPlay: 1,
      board: null,
      markerMap: null,
      moveName: null
    };
  }

  function buildLinearTree(length) {
    const root = makeNode(null, null);
    let current = root;
    for (let i = 0; i < length; i++) {
      const child = makeNode([i, i], current);
      current.children.push(child);
      current = child;
    }
    return { root, leaf: current };
  }

  function buildBranchingTree() {
    const root = makeNode(null, null);
    const move1 = makeNode([3, 3], root);
    root.children.push(move1);
    const move2a = makeNode([15, 3], move1);
    const move2b = makeNode([3, 15], move1);
    move1.children.push(move2a);
    move1.children.push(move2b);
    const move3a = makeNode([15, 15], move2a);
    move2a.children.push(move3a);
    const move3b = makeNode([9, 9], move2b);
    move2b.children.push(move3b);
    return { root, move1, move2a, move2b, move3a, move3b };
  }

  function buildTreeWithComments() {
    const root = makeNode(null, null);
    const move1 = makeNode([3, 3], root, 'Opening move');
    root.children.push(move1);
    const move2 = makeNode([15, 15], move1);
    move1.children.push(move2);
    const move3 = makeNode([3, 15], move2, 'Good response');
    move2.children.push(move3);
    return { root, move1, move2, move3 };
  }

  const { Story } = defineMeta({
    component: GameGraph,
    tags: ['autodocs'],
    parameters: { layout: 'game-app' },
    args: {
      onSelectNode: fn()
    }
  });
</script>

<Story name="Single node">
  {@const node = makeNode(null, null)}
  <div style="width: 240px; height: 200px;">
    <GameGraph
      root={node}
      currentNode={node}
      version={0}
      onSelectNode={fn()}
    />
  </div>
</Story>

<Story name="Linear game">
  {@const tree = buildLinearTree(10)}
  <div style="width: 240px; height: 300px;">
    <GameGraph
      root={tree.root}
      currentNode={tree.leaf}
      version={0}
      onSelectNode={fn()}
    />
  </div>
</Story>

<Story name="With branches">
  {@const tree = buildBranchingTree()}
  <div style="width: 240px; height: 300px;">
    <GameGraph
      root={tree.root}
      currentNode={tree.move2a}
      version={0}
      onSelectNode={fn()}
    />
  </div>
</Story>

<Story name="With comments (orange nodes)">
  {@const tree = buildTreeWithComments()}
  <div style="width: 240px; height: 300px;">
    <GameGraph
      root={tree.root}
      currentNode={tree.move3}
      version={0}
      onSelectNode={fn()}
    />
  </div>
</Story>

<Story name="Current at root">
  {@const tree = buildBranchingTree()}
  <div style="width: 240px; height: 300px;">
    <GameGraph
      root={tree.root}
      currentNode={tree.root}
      version={0}
      onSelectNode={fn()}
    />
  </div>
</Story>

<Story name="Current on branch">
  {@const tree = buildBranchingTree()}
  <div style="width: 240px; height: 300px;">
    <GameGraph
      root={tree.root}
      currentNode={tree.move3b}
      version={0}
      onSelectNode={fn()}
    />
  </div>
</Story>
