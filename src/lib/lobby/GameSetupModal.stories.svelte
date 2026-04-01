<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import { expect, fn, userEvent } from 'storybook/test';
  import GameSetupModal from './GameSetupModal.svelte';

  const { Story } = defineMeta({
    component: GameSetupModal,
    tags: ['autodocs'],
    args: {
      onClose: fn()
    }
  });
</script>

<Story
  name="Create a game"
  args={{ gameType: 'hook' }}
  play={async ({ canvas }) => {
    await expect(canvas.getByText('Game Setup')).toBeInTheDocument();
    await expect(canvas.getByText('Create a game')).toBeInTheDocument();
  }}
/>

<Story
  name="Challenge a friend"
  args={{ gameType: 'friend' }}
  play={async ({ canvas }) => {
    await expect(canvas.getByText('Challenge a friend')).toBeInTheDocument();
  }}
/>

<Story
  name="Board size selection"
  args={{ gameType: 'hook' }}
  play={async ({ canvas }) => {
    await expect(canvas.getByText('9×9')).toBeInTheDocument();
    await expect(canvas.getByText('13×13')).toBeInTheDocument();
    await expect(canvas.getByText('19×19')).toBeInTheDocument();
  }}
/>

<Story
  name="Switch to Fischer"
  args={{ gameType: 'hook' }}
  play={async ({ canvas }) => {
    const fischerTab = canvas.getByText('Fischer');
    await userEvent.click(fischerTab);
    await expect(canvas.getByText('5+0')).toBeInTheDocument();
    await expect(canvas.getByText('10+0')).toBeInTheDocument();
  }}
/>

<Story
  name="Switch to correspondence"
  args={{ gameType: 'hook' }}
  play={async ({ canvas }) => {
    const corrTab = canvas.getByText('Correspondence');
    await userEvent.click(corrTab);
    await expect(canvas.getByText('1 day')).toBeInTheDocument();
    await expect(canvas.getByText('7 days')).toBeInTheDocument();
  }}
/>

<Story
  name="Switch to unlimited"
  args={{ gameType: 'hook' }}
  play={async ({ canvas }) => {
    const unlimitedTab = canvas.getByText('Unlimited');
    await userEvent.click(unlimitedTab);
    await expect(canvas.getByText('No time limit')).toBeInTheDocument();
  }}
/>

<Story
  name="Color selection"
  args={{ gameType: 'hook' }}
  play={async ({ canvas }) => {
    await expect(canvas.getByText('Black')).toBeInTheDocument();
    await expect(canvas.getByText('Random')).toBeInTheDocument();
    await expect(canvas.getByText('White')).toBeInTheDocument();
  }}
/>
