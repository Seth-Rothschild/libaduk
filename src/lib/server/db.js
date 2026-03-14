import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const DATA_DIR = 'data';
const DB_PATH = join(DATA_DIR, 'db.json');

const EMPTY_DB = { users: {}, games: {}, sessions: {}, credentials: {} };

function loadFromDisk() {
	try {
		const saved = JSON.parse(readFileSync(DB_PATH, 'utf8'));
		return { ...structuredClone(EMPTY_DB), ...saved };
	} catch {
		return structuredClone(EMPTY_DB);
	}
}

// Survive HMR reloads — keep the in-memory DB across module re-evaluations
if (!global.__db) {
	mkdirSync(DATA_DIR, { recursive: true });
	global.__db = loadFromDisk();
}
const db = global.__db;

let flushPending = false;

function schedulFlush() {
	if (flushPending) return;
	flushPending = true;
	setImmediate(() => {
		flushPending = false;
		writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
	});
}

// --- Users ---

export function getUser(username) {
	return db.users[username.toLowerCase()] ?? null;
}

export function searchUsers(query, limit = 10) {
	const needle = query.toLowerCase();
	return Object.values(db.users)
		.filter((u) => u.username.toLowerCase().includes(needle))
		.slice(0, limit);
}

export function createUser(username) {
	const key = username.toLowerCase();
	if (db.users[key]) throw new Error('Username already taken');
	const user = { username, createdAt: Date.now() };
	db.users[key] = user;
	schedulFlush();
	return user;
}

// --- Games ---

export function getGame(id) {
	return db.games[id] ?? null;
}

export function createGame({
	id,
	size,
	blackName,
	whiteName,
	timeControl = { type: 'none' },
	komi = 6.5,
	local = false
}) {
	const game = {
		id,
		size,
		blackName,
		whiteName,
		local,
		moves: [],
		status: 'waiting',
		timeControl,
		komi,
		createdAt: Date.now(),
		endedAt: null,
		winner: null,
		result: null,
		corrActiveColor: null,
		corrTurnDeadline: null
	};
	db.games[id] = game;
	schedulFlush();
	return game;
}

export function updateGame(id, patch) {
	const game = db.games[id];
	if (!game) return;
	Object.assign(game, patch);
	schedulFlush();
}

export function appendMove(id, moveEntry) {
	const game = db.games[id];
	if (!game) return;
	game.moves.push(moveEntry);
	schedulFlush();
}

export function getPendingGames() {
	return Object.values(db.games)
		.filter((g) => g.status === 'waiting' && (g.blackName || g.whiteName))
		.map((g) => ({
			id: g.id,
			creator: g.blackName || g.whiteName,
			size: g.size,
			timeControl: g.timeControl,
			createdAt: g.createdAt
		}));
}

export function getUserGames(username) {
	return Object.values(db.games)
		.filter((g) => g.blackName === username || g.whiteName === username)
		.filter((g) => g.status === 'playing' || g.status === 'waiting')
		.map((g) => {
			const myColor = g.blackName === username ? 'black' : 'white';
			const isCorr = g.timeControl?.type === 'correspondence';
			return {
				id: g.id,
				status: g.status,
				timeControl: g.timeControl,
				opponent: g.blackName === username ? g.whiteName : g.blackName,
				isMyTurn: isCorr ? g.corrActiveColor === myColor : null,
				corrTurnDeadline: isCorr ? g.corrTurnDeadline : null
			};
		});
}

export function appendChat(gameId, entry) {
	const game = db.games[gameId];
	if (!game) return;
	if (!game.chat) game.chat = [];
	game.chat.push(entry);
	schedulFlush();
}

export function getChat(gameId) {
	const game = db.games[gameId];
	return game?.chat ?? [];
}

export function setNote(gameId, username, text) {
	const game = db.games[gameId];
	if (!game) return;
	if (!game.notes) game.notes = {};
	game.notes[username.toLowerCase()] = text;
	schedulFlush();
}

export function getNote(gameId, username) {
	const game = db.games[gameId];
	if (!game?.notes) return '';
	return game.notes[username.toLowerCase()] ?? '';
}

export function getAllActiveGames() {
	return Object.values(db.games).filter((g) => g.status === 'playing');
}

export function getAllUserGames(username) {
	return Object.values(db.games)
		.filter((g) => g.blackName === username || g.whiteName === username)
		.filter((g) => g.status !== 'aborted')
		.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
}

// --- WebAuthn Credentials ---

export function getCredentials(username) {
	const key = username.toLowerCase();
	const stored = db.credentials[key] ?? [];
	return stored.map((c) => ({
		...c,
		publicKey: new Uint8Array(Buffer.from(c.publicKey, 'base64url'))
	}));
}

export function addCredential(username, credential) {
	const key = username.toLowerCase();
	if (!db.credentials[key]) db.credentials[key] = [];
	db.credentials[key].push({
		...credential,
		publicKey: Buffer.from(credential.publicKey).toString('base64url')
	});
	schedulFlush();
}

export function updateCredentialCounter(username, credentialId, newCounter) {
	const key = username.toLowerCase();
	const creds = db.credentials[key] ?? [];
	const cred = creds.find((c) => c.id === credentialId);
	if (cred) {
		cred.counter = newCounter;
		schedulFlush();
	}
}

// --- Sessions ---

export function createSession(token, username) {
	db.sessions[token] = { username, createdAt: Date.now() };
	schedulFlush();
}

export function getSession(token) {
	return token ? (db.sessions[token] ?? null) : null;
}

export function deleteSession(token) {
	delete db.sessions[token];
	schedulFlush();
}
