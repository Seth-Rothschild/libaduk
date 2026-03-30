import { redirect, fail } from '@sveltejs/kit';
import { getUser, unlinkOgs } from '$lib/server/db.js';

export async function load({ locals }) {
  if (!locals.user) redirect(307, '/login');
  const user = await getUser(locals.user.username);
  return { ogs: user.ogs };
}

export const actions = {
  disconnect: async ({ locals, cookies }) => {
    if (!locals.user) return fail(401, { error: 'Not logged in' });
    await unlinkOgs(locals.user.username);
    cookies.delete('ogs_token', { path: '/' });
    return { disconnected: true };
  }
};
