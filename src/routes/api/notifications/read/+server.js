import { json, error } from '@sveltejs/kit';
import { markAllNotificationsRead } from '$lib/server/db.js';

export async function POST({ locals }) {
  if (!locals.user) throw error(401, 'Not logged in');
  await markAllNotificationsRead(locals.user.username);
  return json({ ok: true });
}
