import { json } from '@sveltejs/kit';
import { getUser } from '$lib/server/db.js';
import { createSession } from '$lib/server/sessions.js';

export async function POST({ request, cookies }) {
	const body = await request.json().catch(() => ({}));
	const username = (body.username ?? '').trim();

	if (!getUser(username)) {
		return json(
			{ error: 'No account with that username. Try registering instead.' },
			{ status: 404 }
		);
	}

	const token = createSession(username);
	cookies.set('session', token, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: false,
		maxAge: 60 * 60 * 24 * 30
	});
	return json({ username });
}
