<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import { expect, fn, userEvent } from 'storybook/test';
  import { themeState } from './theme.svelte.js';
  import BackgroundPane from './BackgroundPane.svelte';

  const { Story } = defineMeta({
    component: BackgroundPane,
    tags: ['autodocs'],
    args: {
      onBack: fn()
    }
  });
</script>

<Story
  name="Default"
  play={async ({ canvas }) => {
    await expect(canvas.getByText('Auto')).toBeInTheDocument();
    await expect(canvas.getByText('Light')).toBeInTheDocument();
    await expect(canvas.getByText('Dark')).toBeInTheDocument();
  }}
/>

<Story
  name="Back button fires callback"
  play={async ({ args, canvas }) => {
    const backBtn = canvas.getByRole('button', { name: 'Background' });
    await userEvent.click(backBtn);
    await expect(args.onBack).toHaveBeenCalledOnce();
  }}
/>

<Story
  name="Selecting Light marks it active"
  play={async ({ canvas }) => {
    const lightBtn = canvas.getByRole('button', { name: 'Light' });
    await userEvent.click(lightBtn);
    await expect(themeState.setting).toBe('light');
    await expect(lightBtn).toHaveClass('active');
  }}
/>

<Story
  name="Selecting Dark marks it active"
  play={async ({ canvas }) => {
    const darkBtn = canvas.getByRole('button', { name: 'Dark' });
    await userEvent.click(darkBtn);
    await expect(themeState.setting).toBe('dark');
    await expect(darkBtn).toHaveClass('active');
  }}
/>
