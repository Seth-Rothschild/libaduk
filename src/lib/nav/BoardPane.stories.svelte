<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import { expect, fn, userEvent } from 'storybook/test';
  import { boardSettings } from './boardSettings.svelte.js';
  import BoardPane from './BoardPane.svelte';

  const { Story } = defineMeta({
    component: BoardPane,
    tags: ['autodocs'],
    args: {
      onBack: fn()
    }
  });
</script>

<Story
  name="Default"
  play={async ({ canvas }) => {
    await expect(canvas.getByText('Coordinates')).toBeInTheDocument();
    await expect(canvas.getByText('Fuzzy placement')).toBeInTheDocument();
    const checkboxes = canvas.getAllByRole('checkbox');
    await expect(checkboxes).toHaveLength(2);
  }}
/>

<Story
  name="Back button fires callback"
  play={async ({ args, canvas }) => {
    const backBtn = canvas.getByRole('button', { name: 'Board' });
    await userEvent.click(backBtn);
    await expect(args.onBack).toHaveBeenCalledOnce();
  }}
/>

<Story
  name="Toggling coordinates updates boardSettings"
  play={async ({ canvas }) => {
    boardSettings.showCoords = false;
    const coordsLabel = canvas.getByText('Coordinates');
    const checkbox = coordsLabel.closest('label').querySelector('input');
    await expect(checkbox).not.toBeChecked();
    await userEvent.click(checkbox);
    await expect(boardSettings.showCoords).toBe(true);
    await expect(checkbox).toBeChecked();
  }}
/>

<Story
  name="Toggling fuzzy placement updates boardSettings"
  play={async ({ canvas }) => {
    boardSettings.fuzzyPlacement = true;
    const fuzzyLabel = canvas.getByText('Fuzzy placement');
    const checkbox = fuzzyLabel.closest('label').querySelector('input');
    await expect(checkbox).toBeChecked();
    await userEvent.click(checkbox);
    await expect(boardSettings.fuzzyPlacement).toBe(false);
    await expect(checkbox).not.toBeChecked();
  }}
/>
