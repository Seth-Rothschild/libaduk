import { json } from '@sveltejs/kit';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { getUser, createUser, addCredential } from '$lib/server/db.js';
import { createSession } from '$lib/server/sessions.js';
import { consumeChallenge } from '$lib/server/challenges.js';

export async function POST({ request, cookies }) {
	const token = cookies.get('webauthn-token');
	const entry = consumeChallenge(token);
	cookies.delete('webauthn-token', { path: '/' });

	if (!entry) {
		return json({ error: 'Registration session expired. Please try again.' }, { status: 400 });
	}

	const { challenge, username } = entry;

	if (getUser(username)) {
		return json({ error: 'Username already taken' }, { status: 409 });
	}

	const url = new URL(request.url);
	const rpID = url.hostname;
	const origin = url.origin;

	const body = await request.json().catch(() => null);
	if (!body) {
		return json({ error: 'Invalid request body' }, { status: 400 });
	}

	let verification;
	try {
		verification = await verifyRegistrationResponse({
			response: body,
			expectedChallenge: challenge,
			expectedOrigin: origin,
			expectedRPID: rpID
		});
	} catch (err) {
		console.error('Registration verification failed:', err);
		return json({ error: 'Verification failed' }, { status: 400 });
	}

	if (!verification.verified) {
		return json({ error: 'Verification failed' }, { status: 400 });
	}

	const { credential } = verification.registrationInfo;

	createUser(username);
	addCredential(username, {
		id: credential.id,
		publicKey: credential.publicKey,
		counter: credential.counter,
		transports: body.response.transports ?? []
	});

	const sessionToken = createSession(username);
	cookies.set('session', sessionToken, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: true,
		maxAge: 60 * 60 * 24 * 30
	});

	return json({ username });
}
