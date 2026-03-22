<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import { expect, fn } from 'storybook/test';
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
  play={async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('.site-title')).not.toBeNull();
    await expect(canvasElement.querySelector('a[href="/login"]')).not.toBeNull();
    await expect(canvasElement.querySelector('a[href="/signup"]')).not.toBeNull();
  }}
/>

<Story
  name="Signed in"
  args={{ username: 'alice' }}
  play={async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('#user_tag')?.textContent).toBe('alice');
  }}
/>

<Story
  name="Hamburger button is present"
  args={{ username: '' }}
  play={async ({ canvasElement }) => {
    const btn = canvasElement.querySelector('.hbg');
    await expect(btn).not.toBeNull();
    await expect(btn.getAttribute('aria-expanded')).toBe('false');
  }}
/>

<Story
  name="Hamburger opens mobile nav"
  args={{ username: '' }}
  play={async ({ canvasElement }) => {
    const btn = canvasElement.querySelector('.hbg');
    btn.click();
    await new Promise((r) => setTimeout(r, 50));
    await expect(btn.getAttribute('aria-expanded')).toBe('true');
  }}
/>

<Story
  name="Hamburger closes mobile nav"
  args={{ username: '' }}
  play={async ({ canvasElement }) => {
    const btn = canvasElement.querySelector('.hbg');
    btn.click();
    await new Promise((r) => setTimeout(r, 50));
    btn.click();
    await new Promise((r) => setTimeout(r, 50));
    await expect(btn.getAttribute('aria-expanded')).toBe('false');
  }}
/>

<Story
  name="Create a game calls onOpenSetup"
  args={{ username: '' }}
  play={async ({ args, canvasElement }) => {
    const btn = canvasElement.querySelector('#topnav button');
    btn.click();
    await expect(args.onOpenSetup).toHaveBeenCalledWith('hook');
  }}
/>

<Story
  name="Challenge a friend calls onOpenSetup"
  args={{ username: '' }}
  play={async ({ args, canvasElement }) => {
    const buttons = canvasElement.querySelectorAll('#topnav button');
    buttons[1].click();
    await expect(args.onOpenSetup).toHaveBeenCalledWith('friend');
  }}
/>
