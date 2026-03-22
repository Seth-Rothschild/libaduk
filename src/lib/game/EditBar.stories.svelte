<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import { expect, fn, userEvent } from 'storybook/test';
  import EditBar from './EditBar.svelte';

  const onSetTool = fn();

  const { Story } = defineMeta({
    component: EditBar,
    tags: ['autodocs'],
    parameters: { layout: 'game-app' },
    args: {
      onSetTool
    }
  });
</script>

<Story
  name="Stone selected"
  args={{ tool: 'stone' }}
  play={async ({ canvas }) => {
    const buttons = canvas.getAllByRole('button');
    await expect(buttons).toHaveLength(7);
    const selected = buttons.filter(b => b.classList.contains('selected'));
    await expect(selected).toHaveLength(1);
    await expect(selected[0]).toHaveAttribute('title', 'Place stones');
  }}
/>

<Story
  name="Cross selected"
  args={{ tool: 'cross' }}
  play={async ({ canvas }) => {
    const buttons = canvas.getAllByRole('button');
    const selected = buttons.filter(b => b.classList.contains('selected'));
    await expect(selected).toHaveLength(1);
    await expect(selected[0]).toHaveAttribute('title', 'Mark X');
  }}
/>

<Story
  name="Click calls onSetTool"
  args={{ tool: 'stone' }}
  play={async ({ canvas, args }) => {
    const buttons = canvas.getAllByRole('button');
    const circleBtn = canvas.getByTitle('Mark circle');
    await userEvent.click(circleBtn);
    await expect(args.onSetTool).toHaveBeenCalledWith('circle');
  }}
/>

<Story
  name="All tools present"
  args={{ tool: 'stone' }}
  play={async ({ canvas }) => {
    await expect(canvas.getByTitle('Place stones')).toBeInTheDocument();
    await expect(canvas.getByTitle('Mark X')).toBeInTheDocument();
    await expect(canvas.getByTitle('Mark triangle')).toBeInTheDocument();
    await expect(canvas.getByTitle('Mark square')).toBeInTheDocument();
    await expect(canvas.getByTitle('Mark circle')).toBeInTheDocument();
    await expect(canvas.getByTitle('Label (A, B, C...)')).toBeInTheDocument();
    await expect(canvas.getByTitle('Number (1, 2, 3...)')).toBeInTheDocument();
  }}
/>
