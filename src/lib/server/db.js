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
    await db.collection('games').createIndex({ owners: 1 });
    await db.collection('credentials').createIndex({ username: 1 });
    await db.collection('credentials').createIndex({ id: 1 });
    await db.collection('puzzles').createIndex({ index: 1 }, { unique: true });
    console.log(`Connected to MongoDB at ${MONGO_URL}/${DB_NAME}`);
    return db;
  })();
  return connectPromise;
}

export async function clearGames() {
  try {
    const d = await getDb();
    await d.collection('games').deleteMany({});
  } catch (err) {
    console.error('[db] clearGames failed:', err.message);
    throw err;
  }
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
  try {
    const d = await getDb();
    const user = await d.collection('users').findOne({ _id: username.toLowerCase() });
    if (!user) return null;
    return {
      username: user.username,
      createdAt: user.createdAt,
      biography: user.biography ?? '',
      realName: user.realName ?? '',
      ranking: user.ranking ?? '',
      ogs: user.ogs ?? null,
      settings: user.settings ?? {}
    };
  } catch (err) {
    console.error('[db] getUser failed:', err.message);
    throw err;
  }
}

export async function updateUserProfile(username, { biography, realName, ranking }) {
  try {
    const key = username.toLowerCase();
    const d = await getDb();
    await d.collection('users').updateOne({ _id: key }, { $set: { biography, realName, ranking } });
  } catch (err) {
    console.error('[db] updateUserProfile failed:', err.message);
    throw err;
  }
}

export async function updateUser(username, patch) {
  try {
    const key = username.toLowerCase();
    const d = await getDb();
    const user = await d.collection('users').findOne({ _id: key });
    const merged = { ...user };
    for (const [k, v] of Object.entries(patch)) {
      if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
        merged[k] = { ...user[k], ...v };
      } else {
        merged[k] = v;
      }
    }
    delete merged._id;
    await d.collection('users').updateOne({ _id: key }, { $set: merged });
  } catch (err) {
    console.error('[db] updateUser failed:', err.message);
    throw err;
  }
}

export async function searchUsers(query, limit = 10) {
  try {
    const needle = query.toLowerCase();
    const d = await getDb();
    const docs = await d
      .collection('users')
      .find({ _id: { $regex: needle } })
      .limit(limit)
      .toArray();
    return docs.map((d) => ({ username: d.username, createdAt: d.createdAt }));
  } catch (err) {
    console.error('[db] searchUsers failed:', err.message);
    throw err;
  }
}

export async function createUser(username) {
  try {
    const key = username.toLowerCase();
    const d = await getDb();
    const existing = await d.collection('users').findOne({ _id: key });
    if (existing) throw new Error('Username already taken');
    const user = { _id: key, username, createdAt: Date.now() };
    await d.collection('users').insertOne(user);
    return { username, createdAt: user.createdAt };
  } catch (err) {
    console.error('[db] createUser failed:', err.message);
    throw err;
  }
}

export async function linkOgs(username, { id, ogsUsername, ranking }) {
  try {
    const key = username.toLowerCase();
    const d = await getDb();
    await d
      .collection('users')
      .updateOne({ _id: key }, { $set: { ogs: { id, username: ogsUsername, ranking } } });
  } catch (err) {
    console.error('[db] linkOgs failed:', err.message);
    throw err;
  }
}

export async function unlinkOgs(username) {
  try {
    const key = username.toLowerCase();
    const d = await getDb();
    await d.collection('users').updateOne({ _id: key }, { $unset: { ogs: '' } });
  } catch (err) {
    console.error('[db] unlinkOgs failed:', err.message);
    throw err;
  }
}

// --- Games ---

export async function getGame(id) {
  try {
    const d = await getDb();
    const doc = await d.collection('games').findOne({ _id: id });
    if (!doc) return null;
    const { _id, ...rest } = doc;
    return { id: _id, ...rest };
  } catch (err) {
    console.error('[db] getGame failed:', err.message);
    throw err;
  }
}

export async function createGame({
  id,
  size,
  blackName,
  whiteName,
  creatorColor = 'black',
  timeControl = { type: 'none' },
  komi = 6.5,
  handicap = 0,
  handicapStones = [],
  gameType = 'hook',
  status = 'waiting',
  aiDifficulty = null,
  ogsGameId = null,
  ogsUserId = null,
  owners = []
}) {
  try {
    const game = {
      _id: id,
      size,
      blackName,
      whiteName,
      owners,
      creatorColor,
      gameType,
      moves: [],
      status,
      timeControl,
      komi,
      handicap,
      handicapStones,
      aiDifficulty,
      ogsGameId,
      ogsUserId,
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
  } catch (err) {
    console.error('[db] createGame failed:', err.message);
    throw err;
  }
}

export async function updateGame(id, patch) {
  try {
    const d = await getDb();
    await d.collection('games').updateOne({ _id: id }, { $set: patch });
  } catch (err) {
    console.error('[db] updateGame failed:', err.message);
    throw err;
  }
}

export async function addOwner(gameId, username) {
  try {
    const d = await getDb();
    await d.collection('games').updateOne({ _id: gameId }, { $addToSet: { owners: username } });
  } catch (err) {
    console.error('[db] addOwner failed:', err.message);
    throw err;
  }
}

export async function appendMove(id, moveEntry) {
  try {
    const d = await getDb();
    await d.collection('games').updateOne({ _id: id }, { $push: { moves: moveEntry } });
  } catch (err) {
    console.error('[db] appendMove failed:', err.message);
    throw err;
  }
}

export async function findMatchingGame(size, timeControl, excludeUsername = null) {
  try {
    const d = await getDb();
    const query = {
      status: 'waiting',
      size,
      gameType: 'hook',
      'timeControl.type': timeControl.type
    };
    if (timeControl.type === 'byoyomi') {
      query['timeControl.initial'] = timeControl.initial;
      query['timeControl.periods'] = timeControl.periods;
      query['timeControl.periodTime'] = timeControl.periodTime;
    } else if (timeControl.type === 'fischer') {
      query['timeControl.initial'] = timeControl.initial;
      query['timeControl.increment'] = timeControl.increment;
    } else if (timeControl.type === 'correspondence') {
      query['timeControl.days'] = timeControl.days;
    }
    if (excludeUsername) {
      query.owners = { $ne: excludeUsername };
    }
    const doc = await d.collection('games').findOne(query, { sort: { createdAt: 1 } });
    if (!doc) return null;
    return { id: doc._id };
  } catch (err) {
    console.error('[db] findMatchingGame failed:', err.message);
    throw err;
  }
}

export async function getPendingGames(tcType = null) {
  try {
    const d = await getDb();
    const query = {
      status: 'waiting',
      gameType: { $nin: ['friend', 'ai'] },
      'owners.0': { $exists: true }
    };
    if (tcType === 'correspondence') {
      query['timeControl.type'] = 'correspondence';
    } else if (tcType === 'live') {
      query['timeControl.type'] = { $ne: 'correspondence' };
    }
    const docs = await d.collection('games').find(query).toArray();
    return docs.map((g) => ({
      id: g._id,
      creator: g.blackName || g.whiteName,
      size: g.size,
      timeControl: g.timeControl,
      createdAt: g.createdAt
    }));
  } catch (err) {
    console.error('[db] getPendingGames failed:', err.message);
    throw err;
  }
}

export async function getUserGames(username) {
  try {
    const d = await getDb();
    const docs = await d
      .collection('games')
      .find({
        owners: username,
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
  } catch (err) {
    console.error('[db] getUserGames failed:', err.message);
    throw err;
  }
}

export async function appendChat(gameId, entry) {
  try {
    const d = await getDb();
    await d.collection('games').updateOne({ _id: gameId }, { $push: { chat: entry } });
  } catch (err) {
    console.error('[db] appendChat failed:', err.message);
    throw err;
  }
}

export async function getChat(gameId) {
  try {
    const d = await getDb();
    const doc = await d.collection('games').findOne({ _id: gameId }, { projection: { chat: 1 } });
    return doc?.chat ?? [];
  } catch (err) {
    console.error('[db] getChat failed:', err.message);
    throw err;
  }
}

export async function setNote(gameId, username, text) {
  try {
    const key = `notes.${username.toLowerCase()}`;
    const d = await getDb();
    await d.collection('games').updateOne({ _id: gameId }, { $set: { [key]: text } });
  } catch (err) {
    console.error('[db] setNote failed:', err.message);
    throw err;
  }
}

export async function getNote(gameId, username) {
  try {
    const d = await getDb();
    const doc = await d.collection('games').findOne({ _id: gameId }, { projection: { notes: 1 } });
    if (!doc?.notes) return '';
    return doc.notes[username.toLowerCase()] ?? '';
  } catch (err) {
    console.error('[db] getNote failed:', err.message);
    throw err;
  }
}

export async function getAllActiveGames() {
  try {
    const d = await getDb();
    const docs = await d
      .collection('games')
      .find({ status: 'playing', gameType: { $ne: 'friend' } })
      .toArray();
    return docs.map((g) => {
      const { _id, ...rest } = g;
      return { id: _id, ...rest };
    });
  } catch (err) {
    console.error('[db] getAllActiveGames failed:', err.message);
    throw err;
  }
}

export async function getAllUserGames(username) {
  try {
    const d = await getDb();
    const docs = await d
      .collection('games')
      .find({
        owners: username,
        status: { $ne: 'cancelled' }
      })
      .sort({ createdAt: -1 })
      .toArray();
    return docs.map((g) => {
      const { _id, ...rest } = g;
      return { id: _id, ...rest };
    });
  } catch (err) {
    console.error('[db] getAllUserGames failed:', err.message);
    throw err;
  }
}

// --- Leaderboards ---

const LEADERBOARD_CATEGORIES = [
  {
    key: 'bullet',
    filter: {
      'timeControl.type': { $in: ['byoyomi', 'fischer'] },
      'timeControl.initial': { $lte: 180 }
    }
  },
  {
    key: 'blitz',
    filter: {
      'timeControl.type': { $in: ['byoyomi', 'fischer'] },
      'timeControl.initial': { $gt: 180, $lte: 600 }
    }
  },
  {
    key: 'rapid',
    filter: {
      'timeControl.type': { $in: ['byoyomi', 'fischer'] },
      'timeControl.initial': { $gt: 600, $lte: 1800 }
    }
  },
  {
    key: 'classical',
    filter: {
      'timeControl.type': { $in: ['byoyomi', 'fischer'] },
      'timeControl.initial': { $gt: 1800 }
    }
  },
  {
    key: 'correspondence',
    filter: { 'timeControl.type': 'correspondence' }
  }
];

async function leaderboardForCategory(collection, filter) {
  const docs = await collection
    .aggregate([
      { $match: { status: 'finished', ...filter } },
      { $unwind: '$owners' },
      { $group: { _id: '$owners', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
      { $project: { _id: 0, username: '$_id', count: 1 } }
    ])
    .toArray();
  return docs;
}

export async function getLeaderboards() {
  const d = await getDb();
  const collection = d.collection('games');

  const allUsers = await d.collection('users').find({}).toArray();
  const usernames = allUsers.map((u) => u.username);

  const result = {};
  for (const category of LEADERBOARD_CATEGORIES) {
    const withGames = await leaderboardForCategory(collection, category.filter);
    const seen = new Set(withGames.map((e) => e.username));
    const zeros = usernames.filter((u) => !seen.has(u)).map((u) => ({ username: u, count: 0 }));
    zeros.sort(() => Math.random() - 0.5);
    result[category.key] = [...withGames, ...zeros].slice(0, 10);
  }

  const puzzleLeaders = await d
    .collection('puzzleCompletions')
    .aggregate([
      { $project: { _id: 1, count: { $size: '$completed' } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
      { $project: { _id: 0, username: '$_id', count: 1 } }
    ])
    .toArray();
  const puzzleSeen = new Set(puzzleLeaders.map((e) => e.username));
  const puzzleZeros = usernames
    .filter((u) => !puzzleSeen.has(u.toLowerCase()))
    .map((u) => ({ username: u.toLowerCase(), count: 0 }));
  puzzleZeros.sort(() => Math.random() - 0.5);
  result['puzzles'] = [...puzzleLeaders, ...puzzleZeros].slice(0, 10);
  return result;
}

// --- WebAuthn Credentials ---

export async function getCredentials(username) {
  try {
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
  } catch (err) {
    console.error('[db] getCredentials failed:', err.message);
    throw err;
  }
}

export async function addCredential(username, credential) {
  try {
    const key = username.toLowerCase();
    const d = await getDb();
    await d.collection('credentials').insertOne({
      username: key,
      ...credential,
      publicKey: Buffer.from(credential.publicKey).toString('base64url'),
      createdAt: Date.now()
    });
  } catch (err) {
    console.error('[db] addCredential failed:', err.message);
    throw err;
  }
}

export async function getCredentialById(credentialId) {
  try {
    const d = await getDb();
    const doc = await d.collection('credentials').findOne({ id: credentialId });
    if (!doc) return null;
    const { _id, ...rest } = doc;
    return {
      ...rest,
      publicKey: new Uint8Array(Buffer.from(rest.publicKey, 'base64url'))
    };
  } catch (err) {
    console.error('[db] getCredentialById failed:', err.message);
    throw err;
  }
}

export async function updateCredentialCounter(username, credentialId, newCounter) {
  try {
    const key = username.toLowerCase();
    const d = await getDb();
    await d
      .collection('credentials')
      .updateOne({ username: key, id: credentialId }, { $set: { counter: newCounter } });
  } catch (err) {
    console.error('[db] updateCredentialCounter failed:', err.message);
    throw err;
  }
}

export async function getCredentialsSummary(username) {
  try {
    const key = username.toLowerCase();
    const d = await getDb();
    const docs = await d.collection('credentials').find({ username: key }).toArray();
    return docs.map((c) => ({
      id: c.id,
      transports: c.transports ?? [],
      createdAt: c.createdAt ?? null
    }));
  } catch (err) {
    console.error('[db] getCredentialsSummary failed:', err.message);
    throw err;
  }
}

// --- Puzzles ---

function dailyPuzzleIndex(totalPuzzles) {
  const today = new Date();
  const year = today.getUTCFullYear();
  const month = today.getUTCMonth();
  const day = today.getUTCDate();
  const daysSinceEpoch = Math.floor(Date.UTC(year, month, day) / 86400000);
  return daysSinceEpoch % totalPuzzles;
}

export async function getPuzzle(id) {
  try {
    const d = await getDb();
    const doc = await d.collection('puzzles').findOne({ _id: id });
    if (!doc) return null;
    const votesUp = doc.votesUp ?? 0;
    const votesDown = doc.votesDown ?? 0;
    const totalVotes = votesUp + votesDown;
    const likes = votesUp;
    return {
      id: doc._id,
      sgf: doc.sgf,
      size: doc.size,
      rating: doc.rating,
      plays: doc.plays,
      likes,
      totalVotes
    };
  } catch (err) {
    console.error('[db] getPuzzle failed:', err.message);
    throw err;
  }
}

export async function getDailyPuzzle() {
  try {
    const d = await getDb();
    const total = await d.collection('puzzles').countDocuments();
    if (total === 0) return null;
    const index = dailyPuzzleIndex(total);
    const doc = await d.collection('puzzles').findOne({ index });
    if (!doc) return null;
    return { id: doc._id, sgf: doc.sgf, size: doc.size, rating: doc.rating, plays: doc.plays };
  } catch (err) {
    console.error('[db] getDailyPuzzle failed:', err.message);
    throw err;
  }
}

export async function getRandomPuzzle() {
  try {
    const d = await getDb();
    const docs = await d
      .collection('puzzles')
      .aggregate([{ $sample: { size: 1 } }])
      .toArray();
    if (docs.length === 0) return null;
    const doc = docs[0];
    return { id: doc._id, sgf: doc.sgf, size: doc.size, rating: doc.rating, plays: doc.plays };
  } catch (err) {
    console.error('[db] getRandomPuzzle failed:', err.message);
    throw err;
  }
}

export async function incrementPuzzlePlays(puzzleId) {
  try {
    const d = await getDb();
    await d.collection('puzzles').updateOne({ _id: puzzleId }, { $inc: { plays: 1 } });
  } catch (err) {
    console.error('[db] incrementPuzzlePlays failed:', err.message);
    throw err;
  }
}

export async function recordPuzzleVote(puzzleId, vote) {
  try {
    const field = vote === 'up' ? 'votesUp' : 'votesDown';
    const d = await getDb();
    await d.collection('puzzles').updateOne({ _id: puzzleId }, { $inc: { [field]: 1 } });
  } catch (err) {
    console.error('[db] recordPuzzleVote failed:', err.message);
    throw err;
  }
}

export async function markPuzzleCompleted(username, puzzleId) {
  try {
    const key = username.toLowerCase();
    const d = await getDb();
    await d
      .collection('puzzleCompletions')
      .updateOne({ _id: key }, { $addToSet: { completed: puzzleId } }, { upsert: true });
  } catch (err) {
    console.error('[db] markPuzzleCompleted failed:', err.message);
    throw err;
  }
}

export async function getUserPuzzleCompletions(username) {
  try {
    const key = username.toLowerCase();
    const d = await getDb();
    const doc = await d.collection('puzzleCompletions').findOne({ _id: key });
    return doc?.completed ?? [];
  } catch (err) {
    console.error('[db] getUserPuzzleCompletions failed:', err.message);
    throw err;
  }
}

// --- Site Stats ---

export async function getSiteStats() {
  const d = await getDb();
  const now = Date.now();
  const oneDayAgo = now - 24 * 60 * 60 * 1000;

  const [
    totalPlayers,
    completedGames,
    completedGamesHvH,
    completedGamesHvAI,
    puzzlePlaysAgg,
    totalPuzzles,
    recentPlayers,
    recentGames,
    recentCompletedGame
  ] = await Promise.all([
    d.collection('users').countDocuments(),
    d.collection('games').countDocuments({ status: 'finished' }),
    d.collection('games').countDocuments({ status: 'finished', aiDifficulty: null }),
    d.collection('games').countDocuments({ status: 'finished', aiDifficulty: { $ne: null } }),
    d
      .collection('puzzles')
      .aggregate([{ $group: { _id: null, total: { $sum: '$plays' } } }])
      .toArray(),
    d.collection('puzzles').countDocuments(),
    d.collection('users').countDocuments({ createdAt: { $gte: oneDayAgo } }),
    d.collection('games').countDocuments({ status: 'finished', endedAt: { $gte: oneDayAgo } }),
    d.collection('games').findOne(
      { status: 'finished' },
      {
        sort: { endedAt: -1 },
        projection: { _id: 1, blackName: 1, whiteName: 1, result: 1, endedAt: 1 }
      }
    )
  ]);

  const completedPuzzles = puzzlePlaysAgg[0]?.total ?? 0;

  const recentGame = recentCompletedGame
    ? {
        id: recentCompletedGame._id,
        blackName: recentCompletedGame.blackName,
        whiteName: recentCompletedGame.whiteName,
        result: recentCompletedGame.result,
        endedAt: recentCompletedGame.endedAt
      }
    : null;

  return {
    totalPlayers,
    completedGames,
    completedGamesHvH,
    completedGamesHvAI,
    completedPuzzles,
    totalPuzzles,
    recentPlayers,
    recentGames,
    recentGame
  };
}

// --- Sessions ---

export async function createSession(token, username) {
  try {
    const d = await getDb();
    await d.collection('sessions').insertOne({ _id: token, username, createdAt: Date.now() });
  } catch (err) {
    console.error('[db] createSession failed:', err.message);
    throw err;
  }
}

export async function getSession(token) {
  if (!token) return null;
  try {
    const d = await getDb();
    const doc = await d.collection('sessions').findOne({ _id: token });
    if (!doc) return null;
    return { username: doc.username, createdAt: doc.createdAt };
  } catch (err) {
    console.error('[db] getSession failed:', err.message);
    throw err;
  }
}

export async function deleteSession(token) {
  try {
    const d = await getDb();
    await d.collection('sessions').deleteOne({ _id: token });
  } catch (err) {
    console.error('[db] deleteSession failed:', err.message);
    throw err;
  }
}
