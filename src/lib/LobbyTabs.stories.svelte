<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect, fn, userEvent } from 'storybook/test';
	import LobbyTabs from './LobbyTabs.svelte';

	const { Story } = defineMeta({
		component: LobbyTabs,
		tags: ['autodocs'],
		args: {
			onTabChange: fn()
		}
	});
</script>

<Story name="Quick pairing active" args={{ activeTab: 'pools' }} />

<Story name="Lobby active" args={{ activeTab: 'lobby' }} />

<Story name="Correspondence active" args={{ activeTab: 'correspondence' }} />

<Story
	name="Click switches tab"
	args={{ activeTab: 'pools' }}
	play={async ({ args, canvas }) => {
		const lobbyBtn = canvas.getByRole('button', { name: 'Lobby' });
		await userEvent.click(lobbyBtn);
		await expect(args.onTabChange).toHaveBeenCalledWith('lobby');
	}}
/>
