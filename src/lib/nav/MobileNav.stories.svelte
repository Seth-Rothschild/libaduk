<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import { expect, fn, userEvent } from 'storybook/test';
  import MobileNav from './MobileNav.svelte';

  const { Story } = defineMeta({
    component: MobileNav,
    tags: ['autodocs'],
    args: {
      onClose: fn(),
      onCreateGame: fn(),
      onChallengeAFriend: fn()
    }
  });
</script>

<Story
  name="Closed: nav is inert"
  args={{ open: false }}
  play={async ({ canvas }) => {
    const nav = canvas.getByRole('navigation');
    await expect(nav).toHaveAttribute('inert');
  }}
/>

<Story
  name="Open: nav shows all links and buttons"
  args={{ open: true }}
  play={async ({ canvas }) => {
    const nav = canvas.getByRole('navigation');
    await expect(nav).not.toHaveAttribute('inert');
    await expect(canvas.getByRole('button', { name: 'Create a game' })).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Challenge a friend' })).toBeInTheDocument();
    await expect(canvas.getByRole('link', { name: 'Scratch board' })).toBeInTheDocument();
  }}
/>

<Story
  name="Overlay click fires onClose"
  args={{ open: true }}
  play={async ({ args, canvas }) => {
    const overlay = canvas.getByRole('button', { name: 'Close navigation' });
    await userEvent.click(overlay);
    await expect(args.onClose).toHaveBeenCalledOnce();
  }}
/>

<Story
  name="Escape key fires onClose"
  args={{ open: true }}
  play={async ({ args }) => {
    await userEvent.keyboard('{Escape}');
    await expect(args.onClose).toHaveBeenCalledOnce();
  }}
/>

<Story
  name="Escape does nothing when closed"
  args={{ open: false }}
  play={async ({ args }) => {
    await userEvent.keyboard('{Escape}');
    await expect(args.onClose).not.toHaveBeenCalled();
  }}
/>

<Story
  name="Create a game fires onCreateGame and onClose"
  args={{ open: true }}
  play={async ({ args, canvas }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Create a game' }));
    await expect(args.onCreateGame).toHaveBeenCalledOnce();
    await expect(args.onClose).toHaveBeenCalledOnce();
  }}
/>

<Story
  name="Challenge a friend fires onChallengeAFriend and onClose"
  args={{ open: true }}
  play={async ({ args, canvas }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Challenge a friend' }));
    await expect(args.onChallengeAFriend).toHaveBeenCalledOnce();
    await expect(args.onClose).toHaveBeenCalledOnce();
  }}
/>

<Story
  name="Nav links fire onClose"
  args={{ open: true }}
  play={async ({ args, canvas }) => {
    const links = canvas.getAllByRole('link');
    await userEvent.click(links[0]);
    await expect(args.onClose).toHaveBeenCalledOnce();
  }}
/>

<Story
  name="Scratch board link"
  args={{ open: true }}
  play={async ({ canvas }) => {
    const link = canvas.getByRole('link', { name: 'Scratch board' });
    await expect(link).toHaveAttribute('href', '/scratch');
  }}
/>
