<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import { expect, fn, userEvent } from 'storybook/test';
  import AnalysisControls from './AnalysisControls.svelte';

  const { Story } = defineMeta({
    component: AnalysisControls,
    tags: ['autodocs'],
    parameters: { layout: 'game-app' },
    args: {
      onStartScoring: fn(),
      onStopScoring: fn(),
      onToggleEstimate: fn()
    }
  });
</script>

<Story
  name="Playing mode"
  args={{
    status: 'playing',
    score: null,
    estimatedScore: null,
    showEstimate: false
  }}
  play={async ({ canvas }) => {
    await expect(canvas.getByText('Score')).toBeInTheDocument();
    await expect(canvas.getByText('Estimate')).toBeInTheDocument();
    await expect(canvas.queryByText('Back to analysis')).not.toBeInTheDocument();
  }}
/>

<Story
  name="Playing with all buttons"
  args={{
    status: 'playing',
    score: null,
    estimatedScore: null,
    showEstimate: false,
    onClear: fn(),
    onDownloadSgf: fn(),
    onImportSgf: fn()
  }}
  play={async ({ canvas }) => {
    await expect(canvas.getByText('Score')).toBeInTheDocument();
    await expect(canvas.getByText('Clear')).toBeInTheDocument();
    await expect(canvas.getByText('Download SGF')).toBeInTheDocument();
    await expect(canvas.getByText('Import SGF')).toBeInTheDocument();
  }}
/>

<Story
  name="Scoring mode"
  args={{
    status: 'scoring',
    score: { blackArea: 50, whiteArea: 30, blackScore: 50, whiteScore: 36.5 },
    estimatedScore: null,
    showEstimate: false
  }}
  play={async ({ canvas }) => {
    await expect(canvas.getByText('Back to analysis')).toBeInTheDocument();
    await expect(canvas.queryByText('Score')).not.toBeInTheDocument();
  }}
/>

<Story
  name="Scoring mode no score yet"
  args={{
    status: 'scoring',
    score: null,
    estimatedScore: null,
    showEstimate: false
  }}
  play={async ({ canvas }) => {
    await expect(canvas.getByText('Back to analysis')).toBeInTheDocument();
  }}
/>

<Story
  name="With estimate active"
  args={{
    status: 'playing',
    score: null,
    estimatedScore: { blackArea: 45, whiteArea: 35, blackScore: 45, whiteScore: 41.5 },
    showEstimate: true
  }}
  play={async ({ canvas }) => {
    const estimateBtn = canvas.getByText('Estimate');
    await expect(estimateBtn).toBeInTheDocument();
  }}
/>

<Story
  name="With exit button"
  args={{
    status: 'playing',
    score: null,
    estimatedScore: null,
    showEstimate: false,
    onExit: fn()
  }}
  play={async ({ canvas }) => {
    await expect(canvas.getByText('Back to game')).toBeInTheDocument();
  }}
/>

<Story
  name="Click score button"
  args={{
    status: 'playing',
    score: null,
    estimatedScore: null,
    showEstimate: false
  }}
  play={async ({ canvas, args }) => {
    await userEvent.click(canvas.getByText('Score'));
    await expect(args.onStartScoring).toHaveBeenCalled();
  }}
/>
