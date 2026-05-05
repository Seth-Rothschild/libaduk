<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import { expect, fn, userEvent } from 'storybook/test';
  import DasherMenu from './DasherMenu.svelte';

  const { Story } = defineMeta({
    component: DasherMenu,
    tags: ['autodocs'],
    args: {
      onSignOut: fn()
    }
  });
</script>

<Story
  name="Signed out"
  args={{ username: '' }}
  play={async ({ canvas }) => {
    await expect(canvas.getByRole('link', { name: 'Register' })).toBeInTheDocument();
    await expect(canvas.getByRole('link', { name: 'Sign in' })).toBeInTheDocument();
  }}
/>

<Story
  name="Signed in"
  args={{ username: 'alice' }}
  play={async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: 'alice' })).toBeInTheDocument();
  }}
/>

<Story
  name="Settings toggle opens dropdown"
  args={{ username: 'alice' }}
  play={async ({ canvas }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'alice' }));
    await expect(canvas.getByRole('button', { name: 'Board' })).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Background' })).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
  }}
/>

<Story
  name="Signed-out dropdown has no sign-out button"
  args={{ username: '' }}
  play={async ({ canvas }) => {
    const toggle = canvas.getByRole('button', { name: 'Settings' });
    await userEvent.click(toggle);
    await expect(canvas.queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument();
  }}
/>

<Story
  name="Sign out fires callback"
  args={{ username: 'alice' }}
  play={async ({ args, canvas }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'alice' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Sign out' }));
    await expect(args.onSignOut).toHaveBeenCalledOnce();
  }}
/>
