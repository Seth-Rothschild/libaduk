import { json, error } from '@sveltejs/kit';
import { clearNotifications } from '$lib/server/db.js';

export async function POST({ locals }) {
  if (!locals.user) throw error(401, 'Not logged in');
  await clearNotifications(locals.user.username);
  return json({ ok: true });
}
