import { randomUUID } from 'crypto';
import { createSession as dbCreate, getSession as dbGet, deleteSession as dbDelete } from './db.js';

export async function createSession(username) {
	const token = randomUUID();
	await dbCreate(token, username);
	return token;
}

export async function getSession(token) {
	return await dbGet(token);
}

export async function deleteSession(token) {
	await dbDelete(token);
}
