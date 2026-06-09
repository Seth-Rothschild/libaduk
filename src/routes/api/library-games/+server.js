import { json } from '@sveltejs/kit';
import { getLibraryRows } from '$lib/server/db.js';

export async function GET() {
  const rows = await getLibraryRows();
  return json(rows);
}
