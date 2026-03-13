import { randomUUID } from 'crypto';
import { createSession as dbCreate, getSession as dbGet, deleteSession as dbDelete } from './db.js';

export function createSession(username) {
	const token = randomUUID();
	dbCreate(token, username);
	return token;
}

export function getSession(token) {
	return dbGet(token);
}

export function deleteSession(token) {
	dbDelete(token);
}
