import { connectDb, createUser, getUser, clearGames, closeDb } from '../../src/lib/server/db.js';
import { createSession } from '../../src/lib/server/sessions.js';

export const TEST_PUZZLE_ID = 'test-puzzle-1';
export const TEST_PUZZLE_SGF = '(;SZ[19]PL[W]AW[je]AB[nh];W[ke])';

export async function resetDb() {
  await connectDb();
  await clearGames();
  await closeDb();
}

export async function seedTestPuzzle() {
  const db = await connectDb();
  await db.collection('puzzles').deleteMany({});
  await db.collection('puzzles').insertOne({
    _id: TEST_PUZZLE_ID,
    sgf: TEST_PUZZLE_SGF,
    size: 19,
    rating: 1500,
    plays: 0,
    index: 0,
    votesUp: 0,
    votesDown: 0
  });
  await closeDb();
}

export async function createTestUser(username) {
  await connectDb();
  const existing = await getUser(username);
  if (!existing) {
    await createUser(username);
  }
  const token = await createSession(username);
  await closeDb();
  return token;
}

export function sessionCookie(token, baseURL) {
  return {
    name: 'session',
    value: token,
    domain: new URL(baseURL).hostname,
    path: '/'
  };
}
