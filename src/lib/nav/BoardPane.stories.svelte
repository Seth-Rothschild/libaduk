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
