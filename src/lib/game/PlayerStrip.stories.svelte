<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import { expect } from 'storybook/test';
  import PlayerStrip from './PlayerStrip.svelte';

  const { Story } = defineMeta({
    component: PlayerStrip,
    tags: ['autodocs']
  });
</script>

<Story
  name="Black top"
  args={{ color: 'black', name: 'Alice', captures: 0, position: 'top' }}
  play={async ({ canvas }) => {
    await expect(canvas.getByText('Alice')).toBeInTheDocument();
  }}
/>

<Story
  name="White bottom with captures"
  args={{ color: 'white', name: 'Bob', captures: 5, position: 'bottom' }}
  play={async ({ canvas }) => {
    await expect(canvas.getByText('Bob')).toBeInTheDocument();
    await expect(canvas.getByText('+5')).toBeInTheDocument();
  }}
/>

<Story
  name="Active player"
  args={{ color: 'black', name: 'Black', captures: 0, position: 'bottom', active: true }}
  play={async ({ canvas }) => {
    await expect(canvas.getByText('Black')).toBeInTheDocument();
  }}
/>

<Story
  name="No captures"
  args={{ color: 'white', name: 'White', captures: 0, position: 'top' }}
  play={async ({ canvas }) => {
    const container = canvas.getByText('White').closest('.ruser');
    await expect(container?.querySelector('.material')).toBeNull();
  }}
/>
