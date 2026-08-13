import { json, error } from '@sveltejs/kit';
import { getNotifications } from '$lib/server/db.js';

export async function GET({ locals }) {
  if (!locals.user) throw error(401, 'Not logged in');
  const notifications = await getNotifications(locals.user.username);
  return json(notifications);
}
