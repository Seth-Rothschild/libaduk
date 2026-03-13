<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect } from 'storybook/test';
	import ActiveGamesPanel from './ActiveGamesPanel.svelte';

	const SAMPLE_GAMES = [
		{ id: 'g1', black: 'alice', white: 'bob', moveCount: 42 },
		{ id: 'g2', black: 'carol', white: 'dave', moveCount: 7 },
		{ id: 'g3', black: 'eve', white: null, moveCount: 0 }
	];

	const { Story } = defineMeta({
		component: ActiveGamesPanel,
		tags: ['autodocs']
	});
</script>

<Story
	name="Empty"
	args={{ games: [] }}
	play={async ({ canvas }) => {
		await expect(canvas.getByText('No games in progress.')).toBeInTheDocument();
	}}
/>

<Story
	name="With games"
	args={{ games: SAMPLE_GAMES }}
	play={async ({ canvas }) => {
		await expect(canvas.getByText('alice vs bob')).toBeInTheDocument();
		await expect(canvas.getByText('42 moves')).toBeInTheDocument();
		await expect(canvas.getByText('eve vs ?')).toBeInTheDocument();
	}}
/>
