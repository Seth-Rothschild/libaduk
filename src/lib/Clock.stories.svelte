<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import { expect } from 'storybook/test';
  import Clock from './Clock.svelte';

  const { Story } = defineMeta({
    component: Clock,
    tags: ['autodocs']
  });
</script>

<Story
  name="Main time running"
  args={{
    clockData: { mainMs: 300000, byoMs: 0, byoPeriods: 0, inByoYomi: false },
    running: true,
    position: 'bottom',
    initialMs: 600000,
    turnStartedAt: Date.now()
  }}
  play={async ({ canvas }) => {
    await expect(canvas.getByRole('timer')).toBeInTheDocument();
  }}
/>

<Story
  name="Main time stopped"
  args={{
    clockData: { mainMs: 120000, byoMs: 0, byoPeriods: 0, inByoYomi: false },
    running: false,
    position: 'top',
    initialMs: 600000
  }}
  play={async ({ canvas }) => {
    await expect(canvas.getByText('2:00')).toBeInTheDocument();
  }}
/>

<Story
  name="Byo-yomi active"
  args={{
    clockData: { mainMs: 0, byoMs: 20000, byoPeriods: 3, periodMs: 20000, inByoYomi: true },
    running: false,
    position: 'bottom',
    initialMs: 600000
  }}
  play={async ({ canvas }) => {
    await expect(canvas.getByText('0:20')).toBeInTheDocument();
    await expect(canvas.getByText('3×20s')).toBeInTheDocument();
  }}
/>

<Story
  name="Emergency (under 30s)"
  args={{
    clockData: { mainMs: 15000, byoMs: 0, byoPeriods: 0, inByoYomi: false },
    running: false,
    position: 'bottom',
    initialMs: 600000
  }}
  play={async ({ canvas }) => {
    const timer = canvas.getByRole('timer');
    await expect(timer.classList.contains('emerg')).toBe(true);
  }}
/>

<Story
  name="Out of time"
  args={{
    clockData: { mainMs: 0, byoMs: 0, byoPeriods: 0, inByoYomi: false },
    running: false,
    position: 'bottom',
    initialMs: 600000
  }}
  play={async ({ canvas }) => {
    await expect(canvas.getByText('0:00')).toBeInTheDocument();
    const timer = canvas.getByRole('timer');
    await expect(timer.classList.contains('outoftime')).toBe(true);
  }}
/>

<Story
  name="Hour format"
  args={{
    clockData: { mainMs: 3661000, byoMs: 0, byoPeriods: 0, inByoYomi: false },
    running: false,
    position: 'bottom',
    initialMs: 7200000
  }}
  play={async ({ canvas }) => {
    await expect(canvas.getByText('1:01:01')).toBeInTheDocument();
  }}
/>

<Story
  name="No clock data"
  args={{
    clockData: null,
    running: false,
    position: 'bottom'
  }}
  play={async ({ canvas }) => {
    const timers = canvas.queryAllByRole('timer');
    await expect(timers.length).toBe(0);
  }}
/>
