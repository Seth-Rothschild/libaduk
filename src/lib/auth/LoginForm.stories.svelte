<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import { expect, fn, userEvent } from 'storybook/test';
  import LoginForm from './LoginForm.svelte';

  const { Story } = defineMeta({
    component: LoginForm,
    tags: ['autodocs'],
    args: {
      error: '',
      submitting: false,
      onSignIn: fn()
    }
  });
</script>

<Story
  name="Default"
  play={async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('.auth-tabs .active')?.textContent).toBe('Sign In');
    await expect(canvasElement.querySelector('button')).not.toBeNull();
    await expect(canvasElement.querySelector('a[href="/signup"]')).not.toBeNull();
  }}
/>

<Story
  name="With error"
  args={{ error: 'Passkey sign-in was cancelled.' }}
  play={async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('.error')?.textContent).toBe(
      'Passkey sign-in was cancelled.'
    );
  }}
/>

<Story
  name="Submitting"
  args={{ submitting: true }}
  play={async ({ canvasElement }) => {
    const btn = canvasElement.querySelector('button');
    await expect(btn?.textContent?.trim()).toBe('Signing in…');
    await expect(btn?.disabled).toBe(true);
  }}
/>

<Story
  name="Button calls onSignIn"
  play={async ({ args, canvasElement }) => {
    const btn = canvasElement.querySelector('button');
    await userEvent.click(btn);
    await expect(args.onSignIn).toHaveBeenCalled();
  }}
/>
