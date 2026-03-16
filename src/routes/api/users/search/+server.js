import { json, error } from '@sveltejs/kit';
import { searchUsers } from '$lib/server/db.js';

export async function GET({ url }) {
  const query = url.searchParams.get('q') ?? '';
  if (query.length < 1) return json([]);
  if (query.length > 30) throw error(400, 'Query too long');
  return json(await searchUsers(query));
}
