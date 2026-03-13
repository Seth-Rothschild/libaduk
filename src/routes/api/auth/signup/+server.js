import { json } from '@sveltejs/kit';
import { createUser, getUser } from '$lib/server/db.js';
import { createSession } from '$lib/server/sessions.js';

const USERNAME_RE = /^[a-zA-Z0-9_]{2,20}$/;

export async function POST({ request, cookies }) {
	const body = await request.json().catch(() => ({}));
	const username = (body.username ?? '').trim();

	if (!USERNAME_RE.test(username)) {
		return json({ error: 'Username must be 2–20 characters: letters, numbers, underscores only' }, { status: 400 });
	}

	if (getUser(username)) {
		return json({ error: 'Username already taken' }, { status: 409 });
	}

	createUser(username);
	const token = createSession(username);
	cookies.set('session', token, { path: '/', httpOnly: true, sameSite: 'lax', secure: false, maxAge: 60 * 60 * 24 * 30 });
	return json({ username });
}
