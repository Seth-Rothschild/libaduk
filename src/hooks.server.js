import { getSession } from '$lib/server/sessions.js';

export async function handle({ event, resolve }) {
  const token = event.cookies.get('session');
  const session = await getSession(token);
  event.locals.user = session ? { username: session.username } : null;
  return resolve(event);
}
