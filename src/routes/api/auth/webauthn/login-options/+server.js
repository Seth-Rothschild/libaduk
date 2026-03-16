import { json } from '@sveltejs/kit';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { createChallenge } from '$lib/server/challenges.js';

export async function POST({ request, cookies }) {
	const url = new URL(request.url);
	const rpID = url.hostname;

	const options = await generateAuthenticationOptions({
		rpID,
		userVerification: 'preferred'
	});

	const token = createChallenge(null, options.challenge);
	cookies.set('webauthn-token', token, {
		path: '/',
		httpOnly: true,
		sameSite: 'strict',
		secure: true,
		maxAge: 300
	});

	return json(options);
}
