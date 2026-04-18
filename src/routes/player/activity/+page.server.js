import { getRecentActivity } from '$lib/server/db.js';

export async function load() {
  const activity = await getRecentActivity();
  return { activity };
}
