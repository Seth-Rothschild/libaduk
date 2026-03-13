import { randomUUID } from 'crypto';

// Survive HMR reloads
if (!global.__sessions) global.__sessions = new Map();
const sessions = global.__sessions;

export function createSession(username) {
	const token = randomUUID();
	sessions.set(token, { username, createdAt: Date.now() });
	return token;
}

export function getSession(token) {
	return token ? (sessions.get(token) ?? null) : null;
}

export function deleteSession(token) {
	sessions.delete(token);
}
