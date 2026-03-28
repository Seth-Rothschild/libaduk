import { json } from '@sveltejs/kit';
import { incrementPuzzlePlays, recordPuzzleVote, markPuzzleCompleted } from '$lib/server/db.js';

export async function POST({ request, locals }) {
  const { puzzleId, vote } = await request.json();

  if (!puzzleId) {
    return json({ error: 'puzzleId required' }, { status: 400 });
  }

  await incrementPuzzlePlays(puzzleId);

  if (vote === 'up' || vote === 'down') {
    await recordPuzzleVote(puzzleId, vote);
  }

  const username = locals.user?.username;
  if (username) {
    await markPuzzleCompleted(username, puzzleId);
  }

  return json({ ok: true });
}
