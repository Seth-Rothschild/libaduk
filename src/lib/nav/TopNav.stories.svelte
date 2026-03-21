<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import { expect, fn, userEvent } from 'storybook/test';
  import TopNav from './TopNav.svelte';

  const { Story } = defineMeta({
    component: TopNav,
    tags: ['autodocs'],
    args: {
      onCreateGame: fn(),
      onChallengeAFriend: fn()
    }
  });
</script>

<Story
  name="Default"
  play={async ({ canvas }) => {
    const nav = canvas.getByRole('navigation');
    await expect(nav).toBeInTheDocument();
    await expect(canvas.getByText('Play')).toBeInTheDocument();
    await expect(canvas.getByText('Tools')).toBeInTheDocument();
  }}
/>

<Story
  name="Create a game fires callback"
  play={async ({ args, canvas }) => {
    const btn = canvas.getByRole('button', { name: 'Create a game' });
    await userEvent.click(btn);
    await expect(args.onCreateGame).toHaveBeenCalledOnce();
  }}
/>

<Story
  name="Challenge a friend fires callback"
  play={async ({ args, canvas }) => {
    const btn = canvas.getByRole('button', { name: 'Challenge a friend' });
    await userEvent.click(btn);
    await expect(args.onChallengeAFriend).toHaveBeenCalledOnce();
  }}
/>

<Story
  name="Analysis board link"
  play={async ({ canvas }) => {
    const link = canvas.getByRole('link', { name: 'Analysis board' });
    await expect(link).toHaveAttribute('href', '/analysis');
  }}
/>
