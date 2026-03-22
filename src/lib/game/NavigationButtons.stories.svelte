<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import { expect, fn } from 'storybook/test';
  import NavigationButtons from './NavigationButtons.svelte';

  const { Story } = defineMeta({
    component: NavigationButtons,
    tags: ['autodocs'],
    parameters: { layout: 'game-app' }
  });
</script>

<Story
  name="All enabled"
  args={{ canPrev: true, canNext: true, onFirst: fn(), onPrev: fn(), onNext: fn(), onLast: fn() }}
  play={async ({ canvas }) => {
    const buttons = canvas.getAllByRole('button');
    await expect(buttons).toHaveLength(4);
    for (const btn of buttons) {
      await expect(btn).not.toBeDisabled();
    }
  }}
/>

<Story
  name="At start"
  args={{ canPrev: false, canNext: true, onFirst: fn(), onPrev: fn(), onNext: fn(), onLast: fn() }}
  play={async ({ canvas }) => {
    const buttons = canvas.getAllByRole('button');
    await expect(buttons[0]).toBeDisabled();
    await expect(buttons[1]).toBeDisabled();
    await expect(buttons[2]).not.toBeDisabled();
    await expect(buttons[3]).not.toBeDisabled();
  }}
/>

<Story
  name="At end"
  args={{ canPrev: true, canNext: false, onFirst: fn(), onPrev: fn(), onNext: fn(), onLast: fn() }}
  play={async ({ canvas }) => {
    const buttons = canvas.getAllByRole('button');
    await expect(buttons[0]).not.toBeDisabled();
    await expect(buttons[1]).not.toBeDisabled();
    await expect(buttons[2]).toBeDisabled();
    await expect(buttons[3]).toBeDisabled();
  }}
/>

<Story
  name="All disabled"
  args={{ canPrev: false, canNext: false, onFirst: fn(), onPrev: fn(), onNext: fn(), onLast: fn() }}
  play={async ({ canvas }) => {
    const buttons = canvas.getAllByRole('button');
    for (const btn of buttons) {
      await expect(btn).toBeDisabled();
    }
  }}
/>
