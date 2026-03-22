<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import { expect, fn, userEvent } from 'storybook/test';
  import HookTable from './HookTable.svelte';

  const now = Date.now();

  const SAMPLE_GAMES = [
    {
      id: 'abc123',
      creator: 'alice',
      createdAt: now - 30 * 1000,
      timeControl: { type: 'byoyomi', initial: 300, periods: 3, periodTime: 20 },
      size: 19
    },
    {
      id: 'def456',
      creator: 'bob',
      createdAt: now - 5 * 60 * 1000,
      timeControl: { type: 'fischer', initial: 600, increment: 5 },
      size: 13
    },
    {
      id: 'ghi789',
      creator: 'carol',
      createdAt: now - 2 * 60 * 60 * 1000,
      timeControl: null,
      size: 9
    }
  ];

  const { Story } = defineMeta({
    component: HookTable,
    tags: ['autodocs'],
    parameters: { layout: 'lobby-app' },
    args: {
      onJoin: fn()
    }
  });
</script>

<Story
  name="Empty"
  args={{ games: [] }}
  play={async ({ canvas }) => {
    await expect(canvas.getByText('No open games.')).toBeInTheDocument();
  }}
/>

<Story
  name="With games"
  args={{ games: SAMPLE_GAMES }}
  play={async ({ canvas }) => {
    await expect(canvas.getByText('alice')).toBeInTheDocument();
    await expect(canvas.getByText('5+3×20s')).toBeInTheDocument();
    await expect(canvas.getByText('10+5')).toBeInTheDocument();
    await expect(canvas.getByText('∞')).toBeInTheDocument();
  }}
/>

<Story
  name="Click joins game"
  args={{ games: SAMPLE_GAMES }}
  play={async ({ args, canvas }) => {
    await userEvent.click(canvas.getByText('alice'));
    await expect(args.onJoin).toHaveBeenCalledWith('abc123');
  }}
/>
