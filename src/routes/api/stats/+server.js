import { json } from '@sveltejs/kit';
import { getSiteStats } from '$lib/server/db.js';

export async function GET() {
  const stats = await getSiteStats();
  return json(stats);
}
