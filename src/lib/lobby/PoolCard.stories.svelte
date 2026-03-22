<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import { expect, fn, userEvent } from 'storybook/test';
  import PoolCard from './PoolCard.svelte';

  const { Story } = defineMeta({
    component: PoolCard,
    tags: ['autodocs'],
    parameters: { layout: 'lobby-app' },
    args: {
      onClick: fn()
    }
  });
</script>

<Story name="Bullet" args={{ clock: '1+3×20s', label: 'Bullet' }} />

<Story name="Blitz" args={{ clock: '5+3×20s', label: 'Blitz' }} />

<Story name="Rapid" args={{ clock: '20+3×30s', label: 'Rapid' }} />

<Story name="Classical" args={{ clock: '60+5×60s', label: 'Classical' }} />

<Story name="Custom" args={{ clock: 'Custom', custom: true }} />

<Story name="Correspondence" args={{ clock: '7 days', label: 'Correspondence' }} />

<Story
  name="Click fires callback"
  args={{ clock: '5+3×20s', label: 'Blitz' }}
  play={async ({ args, canvas }) => {
    const card = canvas.getByRole('button');
    await userEvent.click(card);
    await expect(args.onClick).toHaveBeenCalledOnce();
  }}
/>

<Story
  name="Enter key fires callback"
  args={{ clock: '5+3×20s', label: 'Blitz' }}
  play={async ({ args, canvas }) => {
    const card = canvas.getByRole('button');
    card.focus();
    await userEvent.keyboard('{Enter}');
    await expect(args.onClick).toHaveBeenCalledOnce();
  }}
/>
