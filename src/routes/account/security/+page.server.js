import { redirect } from '@sveltejs/kit';
import { getCredentialsSummary } from '$lib/server/db.js';

export async function load({ locals }) {
  if (!locals.user) redirect(307, '/login');
  const credentials = await getCredentialsSummary(locals.user.username);
  return { credentials };
}
