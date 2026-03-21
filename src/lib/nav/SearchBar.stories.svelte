<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import { expect, vi, userEvent } from 'storybook/test';
  import { goto } from '$app/navigation';
  import SearchBar from './SearchBar.svelte';

  const { Story } = defineMeta({
    component: SearchBar,
    tags: ['autodocs']
  });

  function mockSearchResults(usernames: string[]) {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      json: async () => usernames.map((username) => ({ username }))
    } as Response);
  }
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
    const icon = canvas.getByRole('link', { name: 'Search' });
    await userEvent.click(icon);
    await expect(document.body).toHaveClass('clinput');
    const input = canvas.getByRole('textbox', { name: 'Search' });
    await expect(input).toHaveFocus();
  }}
/>

<Story
  name="Click result navigates to profile"
  play={async ({ canvas }) => {
    mockSearchResults(['alice', 'alicia']);

    const container = canvas.getByRole('textbox', { name: 'Search' }).closest('#clinput')!;
    await userEvent.hover(container);
    const input = canvas.getByRole('textbox', { name: 'Search' });
    await userEvent.type(input, 'ali');

    const result = await vi.waitFor(() => canvas.getByRole('button', { name: 'alice' }));
    await userEvent.click(result);

    await expect(goto).toHaveBeenCalledWith('/profile/alice');
    vi.restoreAllMocks();
  }}
/>

<Story
  name="Click result collapses search and clears query"
  play={async ({ canvas }) => {
    mockSearchResults(['alice']);

    const container = canvas.getByRole('textbox', { name: 'Search' }).closest('#clinput')!;
    await userEvent.hover(container);
    const input = canvas.getByRole('textbox', { name: 'Search' });
    await userEvent.type(input, 'ali');

    const result = await vi.waitFor(() => canvas.getByRole('button', { name: 'alice' }));
    await userEvent.click(result);

    await expect(document.body).not.toHaveClass('clinput');
    await expect(canvas.queryByRole('button', { name: 'alice' })).not.toBeInTheDocument();
    vi.restoreAllMocks();
  }}
/>
