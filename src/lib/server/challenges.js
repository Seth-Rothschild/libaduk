import { randomUUID } from 'crypto';

const TIMEOUT_MS = 5 * 60 * 1000;

// token -> { challenge, username, expiresAt }
const pending = new Map();

export function createChallenge(username, challenge) {
  const token = randomUUID();
  pending.set(token, { challenge, username, expiresAt: Date.now() + TIMEOUT_MS });
  return token;
}

export function consumeChallenge(token) {
  if (!token) return null;
  const entry = pending.get(token);
  pending.delete(token);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) return null;
  return { challenge: entry.challenge, username: entry.username };
}
