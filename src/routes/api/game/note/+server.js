import { json, error } from '@sveltejs/kit';
import { setNote } from '$lib/server/db.js';

export async function POST({ request, locals }) {
	if (!locals.user) throw error(401, 'Not logged in');
	const { gameId, text } = await request.json();
	if (!gameId) throw error(400, 'Missing gameId');
	setNote(gameId, locals.user.username, (text ?? '').slice(0, 5000));
	return json({ ok: true });
}
