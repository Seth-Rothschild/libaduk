<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import { expect, fn, userEvent } from 'storybook/test';
  import PoolGrid from './PoolGrid.svelte';

  const LIVE_POOLS = [
    { clock: '1+3×20s', label: 'Bullet' },
    { clock: '3+3×20s', label: 'Bullet' },
    { clock: '5+3×20s', label: 'Blitz' },
    { clock: '10+3×20s', label: 'Blitz' },
    { clock: '20+3×30s', label: 'Rapid' },
    { clock: '30+5×30s', label: 'Rapid' },
    { clock: '40+0', label: 'Standard' },
    { clock: '60+5×60s', label: 'Classical' }
  ];

  const CORR_POOLS = [
    { clock: '1 day', label: 'Correspondence' },
    { clock: '3 days', label: 'Correspondence' },
    { clock: '7 days', label: 'Correspondence' },
    { clock: '14 days', label: 'Correspondence' }
  ];

  const { Story } = defineMeta({
    component: PoolGrid,
    tags: ['autodocs'],
    args: {
      onSelect: fn(),
      onCustom: fn()
    }
  });
</script>

<Story
  name="Quick pairing pools"
  args={{ pools: LIVE_POOLS, showCustom: true }}
  play={async ({ canvas }) => {
    await expect(canvas.getByText('1+3×20s')).toBeInTheDocument();
    await expect(canvas.getByText('Custom')).toBeInTheDocument();
  }}
/>

<Story
  name="Correspondence pools"
  args={{ pools: CORR_POOLS, showCustom: false }}
  play={async ({ canvas }) => {
    await expect(canvas.getByText('7 days')).toBeInTheDocument();
    await expect(canvas.queryByText('Custom')).not.toBeInTheDocument();
  }}
/>

<Story
  name="Click selects pool"
  args={{ pools: LIVE_POOLS, showCustom: false }}
  play={async ({ args, canvas }) => {
    await userEvent.click(canvas.getByText('5+3×20s'));
    await expect(args.onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ clock: '5+3×20s', label: 'Blitz' })
    );
  }}
/>

<Story
  name="Click custom"
  args={{ pools: LIVE_POOLS, showCustom: true }}
  play={async ({ args, canvas }) => {
    await userEvent.click(canvas.getByText('Custom'));
    await expect(args.onCustom).toHaveBeenCalledOnce();
  }}
/>
