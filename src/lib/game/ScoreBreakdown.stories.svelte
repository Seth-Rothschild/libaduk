<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import { expect } from 'storybook/test';
  import ScoreBreakdown from './ScoreBreakdown.svelte';

  const { Story } = defineMeta({
    component: ScoreBreakdown,
    tags: ['autodocs']
  });
</script>

<Story
  name="Black winning"
  args={{
    score: { blackArea: 50, whiteArea: 30, blackScore: 50, whiteScore: 36.5 },
    komi: 6.5
  }}
  play={async ({ canvas }) => {
    await expect(canvas.getByText('50')).toBeInTheDocument();
    await expect(canvas.getByText('Black leads by 13.5')).toBeInTheDocument();
  }}
/>

<Story
  name="White winning"
  args={{
    score: { blackArea: 30, whiteArea: 40, blackScore: 30, whiteScore: 46.5 },
    komi: 6.5
  }}
  play={async ({ canvas }) => {
    await expect(canvas.getByText('White leads by 16.5')).toBeInTheDocument();
  }}
/>

<Story
  name="With approvals both pending"
  args={{
    score: { blackArea: 40, whiteArea: 35, blackScore: 40, whiteScore: 41.5 },
    komi: 6.5,
    showApprovals: true,
    blackApproved: false,
    whiteApproved: false
  }}
  play={async ({ canvas }) => {
    await expect(canvas.getByText(/Black/)).toBeInTheDocument();
    await expect(canvas.getByText(/White/)).toBeInTheDocument();
  }}
/>

<Story
  name="With approvals black approved"
  args={{
    score: { blackArea: 40, whiteArea: 35, blackScore: 40, whiteScore: 41.5 },
    komi: 6.5,
    showApprovals: true,
    blackApproved: true,
    whiteApproved: false
  }}
  play={async ({ canvas }) => {
    await expect(canvas.getByText('Black ✓')).toBeInTheDocument();
  }}
/>

<Story
  name="No score"
  args={{ score: null }}
  play={async ({ canvas }) => {
    const container = canvas.getByTestId?.('score-breakdown');
    await expect(container).toBeUndefined();
  }}
/>
