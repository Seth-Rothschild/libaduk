import { json } from '@sveltejs/kit';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import { getCredentials, updateCredentialCounter } from '$lib/server/db.js';
import { createSession } from '$lib/server/sessions.js';
import { consumeChallenge } from '$lib/server/challenges.js';

export async function POST({ request, cookies }) {
	const token = cookies.get('webauthn-token');
	const entry = consumeChallenge(token);
	cookies.delete('webauthn-token', { path: '/' });

	if (!entry) {
		return json({ error: 'Login session expired. Please try again.' }, { status: 400 });
	}

	const { challenge, username } = entry;

	const credentials = getCredentials(username);
	if (credentials.length === 0) {
		return json({ error: 'No passkey registered for this account.' }, { status: 400 });
	}

	const url = new URL(request.url);
	const rpID = url.hostname;
	const origin = url.origin;

	const body = await request.json().catch(() => null);
	if (!body) {
		return json({ error: 'Invalid request body' }, { status: 400 });
	}

	const matchingCredential = credentials.find((c) => c.id === body.id);
	if (!matchingCredential) {
		return json({ error: 'Passkey not recognized.' }, { status: 400 });
	}

	let verification;
	try {
		verification = await verifyAuthenticationResponse({
			response: body,
			expectedChallenge: challenge,
			expectedOrigin: origin,
			expectedRPID: rpID,
			credential: matchingCredential
		});
	} catch (err) {
		console.error('Authentication verification failed:', err);
		return json({ error: 'Verification failed' }, { status: 400 });
	}

	if (!verification.verified) {
		return json({ error: 'Verification failed' }, { status: 400 });
	}

	const { newCounter } = verification.authenticationInfo;
	updateCredentialCounter(username, body.id, newCounter);

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
