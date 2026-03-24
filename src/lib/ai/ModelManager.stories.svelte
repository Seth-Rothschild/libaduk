<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import { expect, fn, userEvent } from 'storybook/test';
  import ModelManager from './ModelManager.svelte';

  const { Story } = defineMeta({
    component: ModelManager,
    tags: ['autodocs'],
    parameters: { layout: 'centered' },
    args: {
      onSaved: fn()
    }
  });
</script>

<Story
  name="No model"
  play={async ({ canvas }) => {
    const button = await canvas.findByRole('button', {
      name: /Download model|Delete model/
    });
    await expect(button).toBeInTheDocument();
  }}
/>

<Story
  name="Attribution visible"
  play={async ({ canvas }) => {
    const link = await canvas.findByRole('link', { name: 'Kaya' });
    await expect(link).toBeInTheDocument();
    await expect(link).toHaveAttribute('href', 'https://github.com/kaya-go/kaya');
  }}
/>
