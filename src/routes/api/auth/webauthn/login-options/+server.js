import { json } from '@sveltejs/kit';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { getUser, getCredentials } from '$lib/server/db.js';
import { createChallenge } from '$lib/server/challenges.js';

export async function POST({ request, cookies }) {
	const body = await request.json().catch(() => ({}));
	const username = (body.username ?? '').trim();

	const user = getUser(username);
	if (!user) {
		return json(
			{ error: 'No account with that username. Try registering instead.' },
			{ status: 404 }
		);
	}

	const credentials = getCredentials(username);
	if (credentials.length === 0) {
		return json({ error: 'No passkey registered for this account.' }, { status: 400 });
	}

	const url = new URL(request.url);
	const rpID = url.hostname;

	const options = await generateAuthenticationOptions({
		rpID,
		userVerification: 'preferred',
		allowCredentials: credentials.map((c) => ({ id: c.id, transports: c.transports }))
	});

	const token = createChallenge(username, options.challenge);
	cookies.set('webauthn-token', token, {
		path: '/',
		httpOnly: true,
		sameSite: 'strict',
		secure: true,
		maxAge: 300
	});

	return json(options);
}
