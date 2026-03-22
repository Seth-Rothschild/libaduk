<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import { expect, fn, userEvent } from 'storybook/test';
  import StartButtons from './StartButtons.svelte';

  const { Story } = defineMeta({
    component: StartButtons,
    tags: ['autodocs'],
    parameters: { layout: 'lobby-table' },
    args: {
      onCreateGame: fn(),
      onChallengeFriend: fn(),
      onPlayLocally: fn()
    }
  });
</script>

<Story
  name="Default"
  args={{ playersOnline: 0, gamesInPlay: 0 }}
  play={async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: 'Create a game' })).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Challenge a friend' })).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Play locally' })).toBeInTheDocument();
  }}
/>

<Story
  name="With counters"
  args={{ playersOnline: 142, gamesInPlay: 37 }}
  play={async ({ canvas }) => {
    await expect(canvas.getByText('142')).toBeInTheDocument();
    await expect(canvas.getByText('37')).toBeInTheDocument();
  }}
/>

<Story
  name="Create game"
  play={async ({ args, canvas }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Create a game' }));
    await expect(args.onCreateGame).toHaveBeenCalledOnce();
  }}
/>

<Story
  name="Challenge friend"
  play={async ({ args, canvas }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Challenge a friend' }));
    await expect(args.onChallengeFriend).toHaveBeenCalledOnce();
  }}
/>

<Story
  name="Play locally"
  play={async ({ args, canvas }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Play locally' }));
    await expect(args.onPlayLocally).toHaveBeenCalledOnce();
  }}
/>
