import { MongoClient } from 'mongodb';

const MONGO_URL = process.env.MONGO_URL ?? 'mongodb://localhost:27017';
const DB_NAME = process.env.MONGO_DB ?? 'libaduk';

let client = null;
let db = null;
let connectPromise = null;

export async function connectDb() {
	if (db) return db;
	if (connectPromise) return connectPromise;
	connectPromise = (async () => {
		client = new MongoClient(MONGO_URL);
		await client.connect();
		db = client.db(DB_NAME);
		await db.collection('games').createIndex({ status: 1 });
		await db.collection('games').createIndex({ blackName: 1 });
		await db.collection('games').createIndex({ whiteName: 1 });
		await db.collection('credentials').createIndex({ username: 1 });
		console.log(`Connected to MongoDB at ${MONGO_URL}/${DB_NAME}`);
		return db;
	})();
	return connectPromise;
}

export async function closeDb() {
	if (client) {
		await client.close();
		client = null;
		db = null;
		connectPromise = null;
	}
}

async function getDb() {
	if (db) return db;
	return connectDb();
}

// --- Users ---

export async function getUser(username) {
	const d = await getDb();
	const doc = await d.collection('users').findOne({ _id: username.toLowerCase() });
	if (!doc) return null;
	return { username: doc.username, createdAt: doc.createdAt };
}

export async function searchUsers(query, limit = 10) {
	const needle = query.toLowerCase();
	const d = await getDb();
	const docs = await d
		.collection('users')
		.find({ _id: { $regex: needle } })
		.limit(limit)
		.toArray();
	return docs.map((d) => ({ username: d.username, createdAt: d.createdAt }));
}

export async function createUser(username) {
	const key = username.toLowerCase();
	const d = await getDb();
	const existing = await d.collection('users').findOne({ _id: key });
	if (existing) throw new Error('Username already taken');
	const user = { _id: key, username, createdAt: Date.now() };
	await d.collection('users').insertOne(user);
	return { username, createdAt: user.createdAt };
}

// --- Games ---

export async function getGame(id) {
	const d = await getDb();
	const doc = await d.collection('games').findOne({ _id: id });
	if (!doc) return null;
	const { _id, ...rest } = doc;
	return { id: _id, ...rest };
}

export async function createGame({
	id,
	size,
	blackName,
	whiteName,
	creatorColor = 'black',
	timeControl = { type: 'none' },
	komi = 6.5,
	gameType = 'hook'
}) {
	const game = {
		_id: id,
		size,
		blackName,
		whiteName,
		creatorColor,
		gameType,
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
	const d = await getDb();
	await d.collection('games').insertOne(game);
	const { _id, ...rest } = game;
	return { id: _id, ...rest };
}

export async function updateGame(id, patch) {
	const d = await getDb();
	await d.collection('games').updateOne({ _id: id }, { $set: patch });
}

export async function appendMove(id, moveEntry) {
	const d = await getDb();
	await d.collection('games').updateOne({ _id: id }, { $push: { moves: moveEntry } });
}

export async function getPendingGames() {
	const d = await getDb();
	const docs = await d
		.collection('games')
		.find({
			status: 'waiting',
			gameType: { $nin: ['friend', 'local'] },
			$or: [{ blackName: { $ne: null } }, { whiteName: { $ne: null } }]
		})
		.toArray();
	return docs.map((g) => ({
		id: g._id,
		creator: g.blackName || g.whiteName,
		size: g.size,
		timeControl: g.timeControl,
		createdAt: g.createdAt
	}));
}

export async function getUserGames(username) {
	const d = await getDb();
	const docs = await d
		.collection('games')
		.find({
			$or: [{ blackName: username }, { whiteName: username }],
			status: { $in: ['playing', 'waiting'] }
		})
		.toArray();
	return docs.map((g) => {
		const myColor = g.blackName === username ? 'black' : 'white';
		const isCorr = g.timeControl?.type === 'correspondence';
		return {
			id: g._id,
			status: g.status,
			timeControl: g.timeControl,
			opponent: g.blackName === username ? g.whiteName : g.blackName,
			isMyTurn: isCorr ? g.corrActiveColor === myColor : null,
			corrTurnDeadline: isCorr ? g.corrTurnDeadline : null
		};
	});
}

export async function appendChat(gameId, entry) {
	const d = await getDb();
	await d.collection('games').updateOne({ _id: gameId }, { $push: { chat: entry } });
}

export async function getChat(gameId) {
	const d = await getDb();
	const doc = await d.collection('games').findOne({ _id: gameId }, { projection: { chat: 1 } });
	return doc?.chat ?? [];
}

export async function setNote(gameId, username, text) {
	const key = `notes.${username.toLowerCase()}`;
	const d = await getDb();
	await d.collection('games').updateOne({ _id: gameId }, { $set: { [key]: text } });
}

export async function getNote(gameId, username) {
	const d = await getDb();
	const doc = await d.collection('games').findOne({ _id: gameId }, { projection: { notes: 1 } });
	if (!doc?.notes) return '';
	return doc.notes[username.toLowerCase()] ?? '';
}

export async function getAllActiveGames() {
	const d = await getDb();
	const docs = await d
		.collection('games')
		.find({ status: 'playing', gameType: { $ne: 'friend' } })
		.toArray();
	return docs.map((g) => {
		const { _id, ...rest } = g;
		return { id: _id, ...rest };
	});
}

export async function getAllUserGames(username) {
	const d = await getDb();
	const docs = await d
		.collection('games')
		.find({
			$or: [{ blackName: username }, { whiteName: username }],
			status: { $ne: 'aborted' }
		})
		.sort({ createdAt: -1 })
		.toArray();
	return docs.map((g) => {
		const { _id, ...rest } = g;
		return { id: _id, ...rest };
	});
}

// --- WebAuthn Credentials ---

export async function getCredentials(username) {
	const key = username.toLowerCase();
	const d = await getDb();
	const docs = await d.collection('credentials').find({ username: key }).toArray();
	return docs.map((c) => {
		const { _id, username: _u, ...rest } = c;
		return {
			...rest,
			publicKey: new Uint8Array(Buffer.from(rest.publicKey, 'base64url'))
		};
	});
}

export async function addCredential(username, credential) {
	const key = username.toLowerCase();
	const d = await getDb();
	await d.collection('credentials').insertOne({
		username: key,
		...credential,
		publicKey: Buffer.from(credential.publicKey).toString('base64url')
	});
}

export async function updateCredentialCounter(username, credentialId, newCounter) {
	const key = username.toLowerCase();
	const d = await getDb();
	await d.collection('credentials').updateOne({ username: key, id: credentialId }, { $set: { counter: newCounter } });
}

// --- Sessions ---

export async function createSession(token, username) {
	const d = await getDb();
	await d.collection('sessions').insertOne({ _id: token, username, createdAt: Date.now() });
}

export async function getSession(token) {
	if (!token) return null;
	const d = await getDb();
	const doc = await d.collection('sessions').findOne({ _id: token });
	if (!doc) return null;
	return { username: doc.username, createdAt: doc.createdAt };
}

export async function deleteSession(token) {
	const d = await getDb();
	await d.collection('sessions').deleteOne({ _id: token });
}
