import { json } from '@sveltejs/kit';
import { appendChat, getGame } from '$lib/server/db.js';
import { broadcast, getOgsAdapter, notifyMentions } from '$lib/server/rooms.js';

export async function POST({ request }) {
  const body = await request.json().catch(() => ({}));
  const gameId = body.gameId;
  const user = body.user;
  const text = (body.text ?? '').slice(0, 500);
  if (!gameId || !user || !text) {
    return json({ error: 'Missing fields' }, { status: 400 });
  }
  const entry = { user, text, t: Date.now() };
  await appendChat(gameId, entry);
  broadcast(gameId, { type: 'chat', user, text });
  await notifyMentions(text, { taggedBy: user, gameId });
  const game = await getGame(gameId);
  const ogsAdapter = getOgsAdapter(gameId);
  if (ogsAdapter && game?.gameType === 'ogs') ogsAdapter.sendChat(text);
  return json({ ok: true });
}
