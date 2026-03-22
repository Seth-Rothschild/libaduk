<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import { expect, fn, userEvent } from 'storybook/test';
  import AnalysisInfo from './AnalysisInfo.svelte';

  const { Story } = defineMeta({
    component: AnalysisInfo,
    tags: ['autodocs'],
    parameters: { layout: 'game-app' },
    args: {
      onCommentChange: fn()
    }
  });
</script>

<Story
  name="With move info"
  args={{
    blackCaptures: 3,
    whiteCaptures: 5,
    currentNode: {
      lastMove: [15, 3],
      signToPlay: 1,
      moveName: '4-4 Point'
    },
    boardSize: 19,
    comment: ''
  }}
  play={async ({ canvas }) => {
    await expect(canvas.getByText(/3/)).toBeInTheDocument();
    await expect(canvas.getByText(/5/)).toBeInTheDocument();
    await expect(canvas.getByText('4-4 Point')).toBeInTheDocument();
    await expect(canvas.getByPlaceholderText('Add a comment...')).toBeInTheDocument();
  }}
/>

<Story
  name="No move yet"
  args={{
    blackCaptures: 0,
    whiteCaptures: 0,
    currentNode: {
      lastMove: null,
      signToPlay: 1,
      moveName: null
    },
    boardSize: 19,
    comment: ''
  }}
  play={async ({ canvas }) => {
    await expect(canvas.queryByText('4-4 Point')).not.toBeInTheDocument();
    await expect(canvas.getByPlaceholderText('Add a comment...')).toBeInTheDocument();
  }}
/>

<Story
  name="With existing comment"
  args={{
    blackCaptures: 0,
    whiteCaptures: 0,
    currentNode: {
      lastMove: null,
      signToPlay: 1,
      moveName: null
    },
    boardSize: 19,
    comment: 'This is a test comment'
  }}
  play={async ({ canvas }) => {
    const textarea = canvas.getByPlaceholderText('Add a comment...');
    await expect(textarea).toHaveValue('This is a test comment');
  }}
/>

<Story
  name="Comment input fires callback"
  args={{
    blackCaptures: 0,
    whiteCaptures: 0,
    currentNode: {
      lastMove: null,
      signToPlay: 1,
      moveName: null
    },
    boardSize: 19,
    comment: ''
  }}
  play={async ({ canvas, args }) => {
    const textarea = canvas.getByPlaceholderText('Add a comment...');
    await userEvent.type(textarea, 'Hello');
    await expect(args.onCommentChange).toHaveBeenCalled();
  }}
/>
