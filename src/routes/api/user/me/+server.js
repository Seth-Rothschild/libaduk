import { json } from '@sveltejs/kit';
import { getSession } from '$lib/server/sessions.js';
import { getUser, updateUser } from '$lib/server/db.js';

export async function GET({ cookies }) {
  const token = cookies.get('session');
  const session = await getSession(token);
  if (!session) return json(null, { status: 401 });

  const user = await getUser(session.username);
  return json(user);
}

export async function POST({ cookies, request }) {
  const token = cookies.get('session');
  const session = await getSession(token);
  if (!session) return json(null, { status: 401 });

  const patch = await request.json();
  await updateUser(session.username, patch);
  const user = await getUser(session.username);
  return json(user);
}
