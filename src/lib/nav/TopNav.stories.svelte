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
  name="Community section"
  play={async ({ canvasElement }) => {
    const communityLink = canvasElement.querySelector('a[href="/player"]');
    await expect(communityLink).not.toBeNull();
    const playersLink = canvasElement.querySelector('div[role="group"] a[href="/player"]');
    await expect(playersLink).not.toBeNull();
    await expect(playersLink.textContent).toBe('Players');
  }}
/>

<Story
  name="Puzzles section"
  play={async ({ canvasElement }) => {
    const randomLink = canvasElement.querySelector('a[href="/puzzle"]');
    await expect(randomLink).not.toBeNull();
    const dailyLink = canvasElement.querySelector('a[href="/puzzle/daily"]');
    await expect(dailyLink).not.toBeNull();
    await expect(dailyLink.textContent).toBe('Puzzle of the day');
  }}
/>

<Story
  name="Scratch board link"
  play={async ({ canvasElement }) => {
    const link = canvasElement.querySelector('a[href="/scratch"]');
    await expect(link).not.toBeNull();
    await expect(link.textContent).toBe('Tools');
  }}
/>

<Story
  name="Home link"
  play={async ({ canvasElement }) => {
    const homeLink = canvasElement.querySelector('a[href="/"]');
    await expect(homeLink).not.toBeNull();
    await expect(homeLink.textContent).toContain('libaduk.com');
  }}
/>
