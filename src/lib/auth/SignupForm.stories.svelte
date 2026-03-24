<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import { expect, fn, userEvent } from 'storybook/test';
  import SignupForm from './SignupForm.svelte';

  const { Story } = defineMeta({
    component: SignupForm,
    tags: ['autodocs'],
    args: {
      error: '',
      submitting: false,
      onSignUp: fn()
    }
  });
</script>

<Story
  name="Default"
  play={async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('.auth-tabs .active')?.textContent).toBe('Register');
    await expect(canvasElement.querySelector('input#form3-username')).not.toBeNull();
    await expect(canvasElement.querySelector('a[href="/login"]')).not.toBeNull();
  }}
/>

<Story
  name="With error"
  args={{ error: 'Username already taken.' }}
  play={async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('.error')?.textContent).toBe(
      'Username already taken.'
    );
  }}
/>

<Story
  name="Submitting"
  args={{ submitting: true }}
  play={async ({ canvasElement }) => {
    const btn = canvasElement.querySelector('button[type="submit"]');
    await expect(btn?.textContent?.trim()).toBe('Creating account…');
    await expect(btn?.disabled).toBe(true);
  }}
/>

<Story
  name="Submit calls onSignUp with username"
  play={async ({ args, canvasElement }) => {
    const input = canvasElement.querySelector('input#form3-username');
    await userEvent.type(input, 'alice');
    const form = canvasElement.querySelector('form');
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await expect(args.onSignUp).toHaveBeenCalledWith('alice');
  }}
/>
