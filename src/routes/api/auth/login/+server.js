import { json } from '@sveltejs/kit';
import { getUser } from '$lib/server/db.js';
import { createSession } from '$lib/server/sessions.js';

export async function POST({ request, cookies }) {
  const body = await request.json().catch(() => ({}));
  const username = (body.username ?? '').trim();

  if (!(await getUser(username))) {
    return json(
      { error: 'No account with that username. Try registering instead.' },
      { status: 404 }
    );
  }

  const token = await createSession(username);
  cookies.set('session', token, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    maxAge: 60 * 60 * 24 * 30
  });
  return json({ username });
}
