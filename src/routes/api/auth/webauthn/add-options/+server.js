import { json } from '@sveltejs/kit';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { getCredentials } from '$lib/server/db.js';
import { createChallenge } from '$lib/server/challenges.js';

export async function POST({ request, cookies, locals }) {
  if (!locals.user) {
    return json({ error: 'Not logged in' }, { status: 401 });
  }

  const username = locals.user.username;
  const existingCredentials = await getCredentials(username);

  const url = new URL(request.url);
  const rpID = url.hostname;

  const excludeCredentials = existingCredentials.map((c) => ({
    id: c.id,
    transports: c.transports
  }));

  const options = await generateRegistrationOptions({
    rpName: 'Libaduk',
    rpID,
    userName: username,
    userID: new TextEncoder().encode(username),
    attestationType: 'none',
    excludeCredentials,
    authenticatorSelection: {
      residentKey: 'required',
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
