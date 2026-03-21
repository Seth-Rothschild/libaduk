<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import { expect } from 'storybook/test';
  import SiteTitle from './SiteTitle.svelte';

  const { Story } = defineMeta({
    component: SiteTitle,
    tags: ['autodocs']
  });
</script>

<Story
  name="Default"
  play={async ({ canvas }) => {
    const link = canvas.getByRole('link');
    await expect(link).toHaveAttribute('href', '/');
    await expect(link).toHaveTextContent('libaduk');
  }}
/>
