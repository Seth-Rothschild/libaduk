import { error } from '@sveltejs/kit';
import { loadGameData } from '$lib/server/gameLoader.js';

export async function load({ locals, params, cookies, setHeaders }) {
  const username = locals.user?.username ?? null;
  const guestId = cookies.get('guest-id') ?? null;
  const result = await loadGameData(params.gameId, username, guestId);
  if (!result) throw error(404, 'Game not found');
  setHeaders({ 'cache-control': 'no-store' });
  return {
    user: locals.user,
    game: result.game,
    viewerColor: result.viewerColor,
    chat: result.chat,
    note: result.note
  };
}
