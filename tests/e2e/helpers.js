import { connectDb, createUser, getUser, clearGames, closeDb } from '../../src/lib/server/db.js';
import { createSession } from '../../src/lib/server/sessions.js';

export async function resetDb() {
  await connectDb();
  await clearGames();
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
