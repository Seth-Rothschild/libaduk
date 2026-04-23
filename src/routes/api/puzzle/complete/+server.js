import { json } from '@sveltejs/kit';
import { incrementPuzzlePlays, recordPuzzleVote, recordPuzzleAttempt } from '$lib/server/db.js';

export async function POST({ request, locals }) {
  const { puzzleId, result, vote } = await request.json();

  if (!puzzleId) {
    return json({ error: 'puzzleId required' }, { status: 400 });
  }

  await incrementPuzzlePlays(puzzleId);

  if (vote === 'up' || vote === 'down') {
    await recordPuzzleVote(puzzleId, vote);
  }

  const username = locals.user?.username;
  if (username && (result === 'success' || result === 'failure')) {
    await recordPuzzleAttempt(username, puzzleId, result);
  }

  return json({ ok: true });
}
