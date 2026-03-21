<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import { expect } from 'storybook/test';
  import { pingState } from '$lib/ping.svelte.js';
  import PingStatus from './PingStatus.svelte';

  const { Story } = defineMeta({
    component: PingStatus,
    tags: ['autodocs']
  });
</script>

<Story
  name="No connection"
  play={async ({ canvas }) => {
    pingState.ping = null;
    await expect(canvas.getByText('?')).toBeInTheDocument();
  }}
/>

<Story
  name="Excellent ping"
  play={async ({ canvas }) => {
    pingState.ping = 42;
    await expect(canvas.getByText('42')).toBeInTheDocument();
  }}
/>

<Story
  name="Good ping"
  play={async ({ canvas }) => {
    pingState.ping = 200;
    await expect(canvas.getByText('200')).toBeInTheDocument();
  }}
/>

<Story
  name="Fair ping"
  play={async ({ canvas }) => {
    pingState.ping = 400;
    await expect(canvas.getByText('400')).toBeInTheDocument();
  }}
/>

<Story
  name="Poor ping"
  play={async ({ canvas }) => {
    pingState.ping = 600;
    await expect(canvas.getByText('600')).toBeInTheDocument();
  }}
/>

<Story
  name="Lag link"
  play={async ({ canvas }) => {
    const link = canvas.getByRole('link');
    await expect(link).toHaveAttribute('href', '/lag');
  }}
/>
