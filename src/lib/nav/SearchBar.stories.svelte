<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import { expect, userEvent } from 'storybook/test';
  import SearchBar from './SearchBar.svelte';

  const { Story } = defineMeta({
    component: SearchBar,
    tags: ['autodocs']
  });
</script>

<Story
  name="Default collapsed"
  play={async ({ canvas }) => {
    const input = canvas.getByRole('textbox', { name: 'Search' });
    await expect(input).toBeInTheDocument();
    await expect(document.body).not.toHaveClass('clinput');
  }}
/>

<Story
  name="Expands on mouse enter"
  play={async ({ canvas }) => {
    const container = canvas.getByRole('textbox', { name: 'Search' }).closest('#clinput')!;
    await userEvent.hover(container);
    await expect(document.body).toHaveClass('clinput');
  }}
/>

<Story
  name="Collapses on mouse leave when query is empty"
  play={async ({ canvas }) => {
    const container = canvas.getByRole('textbox', { name: 'Search' }).closest('#clinput')!;
    await userEvent.hover(container);
    await userEvent.unhover(container);
    await expect(document.body).not.toHaveClass('clinput');
  }}
/>

<Story
  name="Stays expanded on mouse leave when query is not empty"
  play={async ({ canvas }) => {
    const container = canvas.getByRole('textbox', { name: 'Search' }).closest('#clinput')!;
    await userEvent.hover(container);
    const input = canvas.getByRole('textbox', { name: 'Search' });
    await userEvent.type(input, 'alice');
    await userEvent.unhover(container);
    await expect(document.body).toHaveClass('clinput');
  }}
/>

<Story
  name="Mobile: tap icon expands search"
  play={async ({ canvas }) => {
    const icon = canvas.getByRole('button', { name: 'Search' });
    await userEvent.click(icon);
    await expect(document.body).toHaveClass('clinput');
    const input = canvas.getByRole('textbox', { name: 'Search' });
    await expect(input).toHaveFocus();
  }}
/>

<Story
  name="Mobile: search stays open after icon tap when mouse leaves"
  play={async ({ canvas }) => {
    const icon = canvas.getByRole('button', { name: 'Search' });
    await userEvent.click(icon);
    const container = canvas.getByRole('textbox', { name: 'Search' }).closest('#clinput')!;
    await userEvent.unhover(container);
    await expect(document.body).toHaveClass('clinput');
  }}
/>
