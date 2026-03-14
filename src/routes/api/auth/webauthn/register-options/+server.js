import { json } from '@sveltejs/kit';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { getUser, getCredentials } from '$lib/server/db.js';
import { createChallenge } from '$lib/server/challenges.js';

const USERNAME_RE = /^[a-zA-Z0-9_]{2,20}$/;

export async function POST({ request, cookies }) {
	const body = await request.json().catch(() => ({}));
	const username = (body.username ?? '').trim();

	if (!USERNAME_RE.test(username)) {
		return json(
			{ error: 'Username must be 2–20 characters: letters, numbers, underscores only' },
			{ status: 400 }
		);
	}

	if (getUser(username)) {
		return json({ error: 'Username already taken' }, { status: 409 });
	}

	const url = new URL(request.url);
	const rpID = url.hostname;

	const options = await generateRegistrationOptions({
		rpName: 'Libaduk',
		rpID,
		userName: username,
		userID: new TextEncoder().encode(username),
		attestationType: 'none',
		excludeCredentials: [],
		authenticatorSelection: {
			residentKey: 'preferred',
			userVerification: 'preferred'
		}
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
