import { error } from '@sveltejs/kit';
import { getUser, getAllUserGames } from '$lib/server/db.js';

export async function load({ params, locals }) {
	const profile = await getUser(params.username);
	if (!profile) throw error(404, 'User not found');

	const games = await getAllUserGames(profile.username);
	const isOwnProfile = locals.user?.username === profile.username;

	return { profile, games, isOwnProfile };
}
