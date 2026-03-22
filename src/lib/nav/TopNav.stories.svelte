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
  play={async ({ args, canvasElement }) => {
    const btn = canvasElement.querySelector('button');
    btn.click();
    await expect(args.onCreateGame).toHaveBeenCalledOnce();
  }}
/>

<Story
  name="Challenge a friend fires callback"
  play={async ({ args, canvasElement }) => {
    const buttons = canvasElement.querySelectorAll('button');
    buttons[1].click();
    await expect(args.onChallengeAFriend).toHaveBeenCalledOnce();
  }}
/>

<Story
  name="Analysis board link"
  play={async ({ canvasElement }) => {
    const link = canvasElement.querySelector('a[href="/analysis"]');
    await expect(link).not.toBeNull();
    await expect(link.getAttribute('href')).toBe('/analysis');
  }}
/>
