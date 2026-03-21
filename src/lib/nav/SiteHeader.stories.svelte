<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import { expect, fn, userEvent } from 'storybook/test';
  import SiteHeader from './SiteHeader.svelte';

  const { Story } = defineMeta({
    component: SiteHeader,
    tags: ['autodocs'],
    args: {
      onOpenSetup: fn()
    }
  });
</script>

<Story
  name="Signed out"
  args={{ username: '' }}
  play={async ({ canvas }) => {
    await expect(canvas.getByRole('link', { name: 'libaduk' })).toBeInTheDocument();
    await expect(canvas.getByRole('link', { name: 'Sign in' })).toBeInTheDocument();
    await expect(canvas.getByRole('link', { name: 'Register' })).toBeInTheDocument();
  }}
/>

<Story
  name="Signed in"
  args={{ username: 'alice' }}
  play={async ({ canvas }) => {
    await expect(canvas.getByRole('link', { name: 'alice' })).toBeInTheDocument();
  }}
/>

<Story
  name="Hamburger button is present"
  args={{ username: '' }}
  play={async ({ canvas }) => {
    const btn = canvas.getByRole('button', { name: 'Menu' });
    await expect(btn).toBeInTheDocument();
    await expect(btn).toHaveAttribute('aria-expanded', 'false');
  }}
/>

<Story
  name="Hamburger opens mobile nav"
  args={{ username: '' }}
  play={async ({ canvas }) => {
    const btn = canvas.getByRole('button', { name: 'Menu' });
    await userEvent.click(btn);
    await expect(btn).toHaveAttribute('aria-expanded', 'true');
    const nav = canvas.getByRole('navigation', { name: '' });
    await expect(nav).not.toHaveAttribute('inert');
  }}
/>

<Story
  name="Hamburger closes mobile nav"
  args={{ username: '' }}
  play={async ({ canvas }) => {
    const btn = canvas.getByRole('button', { name: 'Menu' });
    await userEvent.click(btn);
    await userEvent.click(btn);
    await expect(btn).toHaveAttribute('aria-expanded', 'false');
    const nav = canvas.getByRole('navigation', { name: '' });
    await expect(nav).toHaveAttribute('inert');
  }}
/>

<Story
  name="Create a game calls onOpenSetup"
  args={{ username: '' }}
  play={async ({ args, canvas }) => {
    const btn = canvas.getByRole('button', { name: 'Create a game' });
    await userEvent.click(btn);
    await expect(args.onOpenSetup).toHaveBeenCalledWith('hook');
  }}
/>

<Story
  name="Challenge a friend calls onOpenSetup"
  args={{ username: '' }}
  play={async ({ args, canvas }) => {
    const btn = canvas.getByRole('button', { name: 'Challenge a friend' });
    await userEvent.click(btn);
    await expect(args.onOpenSetup).toHaveBeenCalledWith('friend');
  }}
/>
