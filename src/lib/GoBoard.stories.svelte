<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect, fn } from 'storybook/test';
	import GoBoard from './GoBoard.svelte';

	function emptySignMap(size) {
		return Array.from({ length: size }, () => new Array(size).fill(0));
	}

	function signMapWithStones(size) {
		const map = emptySignMap(size);
		map[3][3] = 1;
		map[3][15] = 1;
		map[15][3] = -1;
		map[15][15] = -1;
		map[9][9] = 1;
		map[9][10] = -1;
		return map;
	}

	const { Story } = defineMeta({
		component: GoBoard,
		tags: ['autodocs'],
		args: {
			onVertexClick: fn()
		}
	});
</script>

<Story
	name="Empty 19x19"
	args={{
		signMap: emptySignMap(19),
		size: 19,
		vertexSize: 24
	}}
	play={async ({ canvas }) => {
		await expect(canvas.getByRole('img', { name: /Go board/ })).toBeInTheDocument();
	}}
/>

<Story
	name="Empty 9x9"
	args={{
		signMap: emptySignMap(9),
		size: 9,
		vertexSize: 24
	}}
/>

<Story
	name="Empty 13x13"
	args={{
		signMap: emptySignMap(13),
		size: 13,
		vertexSize: 24
	}}
/>

<Story
	name="With stones"
	args={{
		signMap: signMapWithStones(19),
		size: 19,
		vertexSize: 24,
		lastMove: [9, 10]
	}}
/>

<Story
	name="With coordinates"
	args={{
		signMap: emptySignMap(19),
		size: 19,
		vertexSize: 24,
		showCoords: true
	}}
	play={async ({ canvas }) => {
		await expect(canvas.getAllByText('A').length).toBeGreaterThan(0);
		await expect(canvas.getAllByText('T').length).toBeGreaterThan(0);
	}}
/>

<Story
	name="Black to play"
	args={{
		signMap: emptySignMap(19),
		size: 19,
		vertexSize: 24,
		currentSign: 1
	}}
/>

<Story
	name="White to play"
	args={{
		signMap: emptySignMap(19),
		size: 19,
		vertexSize: 24,
		currentSign: -1
	}}
/>
