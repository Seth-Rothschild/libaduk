import { json } from '@sveltejs/kit';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { addCredential } from '$lib/server/db.js';
import { consumeChallenge } from '$lib/server/challenges.js';

export async function POST({ request, cookies, locals }) {
  if (!locals.user) {
    return json({ error: 'Not logged in' }, { status: 401 });
  }

  const token = cookies.get('webauthn-token');
  const entry = consumeChallenge(token);
  cookies.delete('webauthn-token', { path: '/' });

  if (!entry) {
    return json({ error: 'Session expired. Please try again.' }, { status: 400 });
  }

  if (entry.username.toLowerCase() !== locals.user.username.toLowerCase()) {
    return json({ error: 'Session mismatch.' }, { status: 400 });
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
      expectedChallenge: entry.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: false
    });
  } catch (err) {
    console.error('Add-passkey verification failed:', err);
    return json({ error: 'Verification failed' }, { status: 400 });
  }

  if (!verification.verified) {
    return json({ error: 'Verification failed' }, { status: 400 });
  }

  const { credential } = verification.registrationInfo;

  await addCredential(locals.user.username, {
    id: credential.id,
    publicKey: credential.publicKey,
    counter: credential.counter,
    transports: body.response.transports ?? []
  });

  return json({ success: true });
}
