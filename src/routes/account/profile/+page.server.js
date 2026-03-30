import { redirect, fail } from '@sveltejs/kit';
import { getUser, updateUserProfile } from '$lib/server/db.js';

const VALID_RANKINGS = new Set([
  '9d',
  '8d',
  '7d',
  '6d',
  '5d',
  '4d',
  '3d',
  '2d',
  '1d',
  '1k',
  '2k',
  '3k',
  '4k',
  '5k',
  '6k',
  '7k',
  '8k',
  '9k',
  '10k',
  '11k',
  '12k',
  '13k',
  '14k',
  '15k',
  '16k',
  '17k',
  '18k',
  '19k',
  '20k',
  ''
]);

export async function load({ locals }) {
  if (!locals.user) redirect(307, '/login');
  const user = await getUser(locals.user.username);
  return {
    biography: user.biography,
    realName: user.realName,
    ranking: user.ranking
  };
}

export const actions = {
  default: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { error: 'Not logged in' });

    const data = await request.formData();
    const biography = data.get('biography')?.toString().trim().slice(0, 400) ?? '';
    const realName = data.get('realName')?.toString().trim().slice(0, 80) ?? '';
    const ranking = data.get('ranking')?.toString().trim() ?? '';

    if (!VALID_RANKINGS.has(ranking)) {
      return fail(400, { error: 'Invalid ranking value' });
    }

    await updateUserProfile(locals.user.username, { biography, realName, ranking });
    return { success: true };
  }
};
