import { MongoClient } from 'mongodb';
import { toJgofTimeControl } from './games/gamedata.js';

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

export async function findGameByOgsId(ogsGameId) {
  try {
    const d = await getDb();
    const doc = await d.collection('games').findOne({
      ogsGameId: String(ogsGameId),
      owners: { $size: 0 }
    });
    return doc?._id ?? null;
  } catch (err) {
    console.error('[db] findGameByOgsId failed:', err.message);
    throw err;
  }
}

export async function createGame({
  id,
  gameType = 'hook',
  owners = [],
  creatorColor = 'black',
  status = 'waiting',
  aiDifficulty = null,
  ogsGameId = null,
  ogsUserId = null,
  gamedata = null
}) {
  try {
    const game = {
      _id: id,
      gameType,
      owners,
      creatorColor,
      status,
      aiDifficulty,
      ogsGameId,
      ogsUserId,
      gamedata,
      chat: [],
      createdAt: Date.now(),
      endedAt: null,
      winner: null,
      result: null
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

export async function deleteGame(id) {
  try {
    const d = await getDb();
    await d.collection('games').deleteOne({ _id: id });
  } catch (err) {
    console.error('[db] deleteGame failed:', err.message);
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

export async function appendGamedataMove(id, packedMove) {
  try {
    const d = await getDb();
    await d.collection('games').updateOne({ _id: id }, { $push: { 'gamedata.moves': packedMove } });
  } catch (err) {
    console.error('[db] appendGamedataMove failed:', err.message);
    throw err;
  }
}

export async function findMatchingGame(size, timeControl, excludeUsername = null) {
  try {
    const d = await getDb();
    const jgof = toJgofTimeControl(timeControl);
    const query = {
      status: 'waiting',
      gameType: 'hook',
      'gamedata.width': size,
      'gamedata.time_control.system': jgof.system
    };
    if (jgof.system === 'byoyomi') {
      query['gamedata.time_control.main_time'] = jgof.main_time;
      query['gamedata.time_control.periods'] = jgof.periods;
      query['gamedata.time_control.period_time'] = jgof.period_time;
    } else if (jgof.system === 'fischer') {
      query['gamedata.time_control.initial_time'] = jgof.initial_time;
      query['gamedata.time_control.time_increment'] = jgof.time_increment;
    } else if (jgof.system === 'simple') {
      query['gamedata.time_control.per_move'] = jgof.per_move;
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
      query['gamedata.time_control.speed'] = 'correspondence';
    } else if (tcType === 'live') {
      query['gamedata.time_control.speed'] = { $ne: 'correspondence' };
    }
    const docs = await d.collection('games').find(query).toArray();
    return docs.map((g) => {
      const players = g.gamedata?.players;
      return {
        id: g._id,
        creator: players?.black?.username || players?.white?.username,
        size: g.gamedata?.width ?? 19,
        timeControl: g.gamedata?.time_control ?? { system: 'none' },
        createdAt: g.createdAt
      };
    });
  } catch (err) {
    console.error('[db] getPendingGames failed:', err.message);
    throw err;
  }
}

function colorToMove(gamedata) {
  const moveCount = (gamedata.moves ?? []).length;
  const firstColor = gamedata.initial_player === 'white' ? 'white' : 'black';
  const otherColor = firstColor === 'black' ? 'white' : 'black';
  return moveCount % 2 === 0 ? firstColor : otherColor;
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
      const gamedata = g.gamedata ?? {};
      const players = gamedata.players ?? {};
      const myColor = players.black?.username === username ? 'black' : 'white';
      const opponentColor = myColor === 'black' ? 'white' : 'black';
      const isCorr = gamedata.time_control?.speed === 'correspondence';
      const isMyTurn = g.status === 'playing' ? colorToMove(gamedata) === myColor : null;
      return {
        id: g._id,
        status: g.status,
        opponent: players[opponentColor]?.username ?? null,
        isMyTurn,
        corrTurnDeadline: isCorr ? (gamedata.clock?.expiration ?? null) : null,
        gamedata
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

export async function loadTvChat() {
  try {
    const d = await getDb();
    const doc = await d.collection('tvChat').findOne({ _id: 'tv' });
    return doc?.messages ?? [];
  } catch (err) {
    console.error('[db] loadTvChat failed:', err.message);
    throw err;
  }
}

export async function pushTvChat(entry, cap = 1000) {
  try {
    const d = await getDb();
    await d
      .collection('tvChat')
      .updateOne(
        { _id: 'tv' },
        { $push: { messages: { $each: [entry], $slice: -cap } } },
        { upsert: true }
      );
  } catch (err) {
    console.error('[db] pushTvChat failed:', err.message);
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

function liveTimeFilter(range) {
  return {
    $or: [
      { 'gamedata.time_control.system': 'byoyomi', 'gamedata.time_control.main_time': range },
      { 'gamedata.time_control.system': 'fischer', 'gamedata.time_control.initial_time': range }
    ]
  };
}

const LEADERBOARD_CATEGORIES = [
  { key: 'bullet', filter: liveTimeFilter({ $lte: 180 }) },
  { key: 'blitz', filter: liveTimeFilter({ $gt: 180, $lte: 600 }) },
  { key: 'rapid', filter: liveTimeFilter({ $gt: 600, $lte: 1800 }) },
  { key: 'classical', filter: liveTimeFilter({ $gt: 1800 }) },
  { key: 'correspondence', filter: { 'gamedata.time_control.speed': 'correspondence' } },
  { key: 'unlimited', filter: { 'gamedata.time_control.system': 'none' } }
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
    .collection('users')
    .aggregate([
      { $unwind: '$attempts' },
      { $match: { 'attempts.result': 'success' } },
      { $group: { _id: '$username', puzzleIds: { $addToSet: '$attempts.puzzleId' } } },
      { $project: { _id: 0, username: '$_id', count: { $size: '$puzzleIds' } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ])
    .toArray();
  const puzzleSeen = new Set(puzzleLeaders.map((e) => e.username));
  const puzzleZeros = usernames
    .filter((u) => !puzzleSeen.has(u))
    .map((u) => ({ username: u, count: 0 }));
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

export async function recordPuzzleAttempt(username, puzzleId, result) {
  try {
    const key = username.toLowerCase();
    const d = await getDb();
    const attempt = { puzzleId, result, attemptedAt: Date.now() };
    await d.collection('users').updateOne({ _id: key }, { $push: { attempts: attempt } });
  } catch (err) {
    console.error('[db] recordPuzzleAttempt failed:', err.message);
    throw err;
  }
}

export async function getUserPuzzleAttempts(username) {
  try {
    const key = username.toLowerCase();
    const d = await getDb();
    const doc = await d.collection('users').findOne({ _id: key }, { projection: { attempts: 1 } });
    return doc?.attempts ?? [];
  } catch (err) {
    console.error('[db] getUserPuzzleAttempts failed:', err.message);
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
    d.collection('games').countDocuments({ status: 'finished', gameType: { $ne: 'uploaded' } }),
    d
      .collection('games')
      .countDocuments({ status: 'finished', gameType: { $ne: 'uploaded' }, aiDifficulty: null }),
    d.collection('games').countDocuments({
      status: 'finished',
      gameType: { $ne: 'uploaded' },
      aiDifficulty: { $ne: null }
    }),
    d
      .collection('users')
      .aggregate([{ $unwind: '$attempts' }, { $count: 'total' }])
      .toArray(),
    d.collection('puzzles').countDocuments(),
    d.collection('users').countDocuments({ createdAt: { $gte: oneDayAgo } }),
    d.collection('games').countDocuments({
      status: 'finished',
      endedAt: { $gte: oneDayAgo },
      gameType: { $ne: 'uploaded' }
    }),
    d.collection('games').findOne(
      { status: 'finished', gameType: { $ne: 'uploaded' } },
      {
        sort: { endedAt: -1 },
        projection: { _id: 1, 'gamedata.players': 1, result: 1, endedAt: 1 }
      }
    )
  ]);

  const completedPuzzles = puzzlePlaysAgg[0]?.total ?? 0;

  const recentGame = recentCompletedGame
    ? {
        id: recentCompletedGame._id,
        blackName: recentCompletedGame.gamedata?.players?.black?.username ?? null,
        whiteName: recentCompletedGame.gamedata?.players?.white?.username ?? null,
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

export async function getRecentActivity() {
  const d = await getDb();
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

  const [gameDocs, userDocs] = await Promise.all([
    d
      .collection('games')
      .find(
        { status: 'finished', endedAt: { $gte: oneDayAgo }, gameType: { $ne: 'uploaded' } },
        { projection: { _id: 1, 'gamedata.players': 1, result: 1, endedAt: 1 } }
      )
      .sort({ endedAt: -1 })
      .toArray(),
    d
      .collection('users')
      .find({ createdAt: { $gte: oneDayAgo } }, { projection: { username: 1, createdAt: 1 } })
      .sort({ createdAt: -1 })
      .toArray()
  ]);

  const games = gameDocs.map((g) => ({
    id: g._id,
    blackName: g.gamedata?.players?.black?.username ?? null,
    whiteName: g.gamedata?.players?.white?.username ?? null,
    result: g.result,
    endedAt: g.endedAt
  }));

  const users = userDocs.map((u) => ({
    username: u.username,
    createdAt: u.createdAt
  }));

  return { games, users };
}

// --- Library ---

export async function getLibraryRows() {
  try {
    const d = await getDb();
    const docs = await d
      .collection('games')
      .find({ gameType: 'uploaded', 'owners.0': { $exists: false } })
      .toArray();

    function toGame(doc) {
      const { _id, ...rest } = doc;
      return { id: _id, ...rest };
    }

    function playerRanking(player) {
      return player?.ranking ?? player?.rank ?? -Infinity;
    }

    function combinedRanking(doc) {
      return (
        playerRanking(doc.gamedata?.players?.black) + playerRanking(doc.gamedata?.players?.white)
      );
    }

    const all = docs.map(toGame);

    function isPro(player) {
      return !!(player?.pro || player?.professional);
    }

    const recent = [...all].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)).slice(0, 20);

    const highRanked = [...all]
      .filter((g) => playerRanking(g.gamedata?.players?.black) !== -Infinity)
      .sort((a, b) => combinedRanking(b) - combinedRanking(a))
      .slice(0, 20);

    const smallBoard = [...all]
      .filter((g) => (g.gamedata?.width ?? g.size) === 9)
      .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
      .slice(0, 20);

    const proGames = [...all]
      .filter((g) => isPro(g.gamedata?.players?.black) || isPro(g.gamedata?.players?.white))
      .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
      .slice(0, 20);

    return { recent, highRanked, smallBoard, proGames };
  } catch (err) {
    console.error('[db] getLibraryRows failed:', err.message);
    throw err;
  }
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
