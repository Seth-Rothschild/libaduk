import { MongoClient } from 'mongodb';

const MONGO_URL = process.env.MONGO_URL ?? 'mongodb://localhost:27017';
const DB_NAME = process.env.MONGO_DB ?? 'libaduk';

const BLACK_ID = 1;
const WHITE_ID = 2;

function encodeCoord(x, y) {
  return String.fromCharCode(97 + x) + String.fromCharCode(97 + y);
}

function packMoves(moveEntries) {
  return (moveEntries ?? []).map((entry) =>
    entry.type === 'pass' ? [-1, -1] : [entry.x, entry.y]
  );
}

function toJgofTimeControl(tc) {
  if (!tc || tc.type === 'none') {
    return { system: 'none', speed: 'live', pause_on_weekends: false };
  }
  if (tc.type === 'byoyomi') {
    return {
      system: 'byoyomi',
      speed: 'live',
      main_time: tc.initial ?? 0,
      period_time: tc.periodTime ?? 30,
      periods: tc.periods ?? 5,
      pause_on_weekends: false
    };
  }
  if (tc.type === 'fischer') {
    return {
      system: 'fischer',
      speed: 'live',
      initial_time: tc.initial ?? 0,
      time_increment: tc.increment ?? 0,
      max_time: tc.max ?? (tc.initial ?? 0) * 10,
      pause_on_weekends: false
    };
  }
  if (tc.type === 'correspondence') {
    return {
      system: 'simple',
      speed: 'correspondence',
      per_move: (tc.days ?? 3) * 24 * 60 * 60,
      pause_on_weekends: false
    };
  }
  return { system: 'none', speed: 'live', pause_on_weekends: false };
}

function phaseFromStatus(status) {
  if (status === 'scoring') return 'stone removal';
  if (status === 'finished' || status === 'cancelled' || status === 'abandoned') return 'finished';
  return 'play';
}

function outcomeFromDoc(doc) {
  if (doc.status === 'cancelled' || doc.status === 'abandoned') return 'Cancellation';
  const result = doc.result ?? '';
  if (result.endsWith('+R')) return 'Resignation';
  if (result.endsWith('+T')) return 'Timeout';
  const margin = result.split('+')[1];
  if (margin) return `${margin} points`;
  return null;
}

function buildGamedata(doc) {
  const handicapStones = doc.handicapStones ?? [];
  const initialBlack = handicapStones.map(({ x, y }) => encodeCoord(x, y)).join('');
  const removed = (doc.deadStones ?? [])
    .map((stone) =>
      Array.isArray(stone) ? encodeCoord(stone[0], stone[1]) : encodeCoord(stone.x, stone.y)
    )
    .join('');
  const winner = doc.winner === 'black' ? BLACK_ID : doc.winner === 'white' ? WHITE_ID : null;
  const outcome = outcomeFromDoc(doc);

  const gamedata = {
    game_id: doc._id,
    width: doc.size ?? 19,
    height: doc.size ?? 19,
    rules: 'chinese',
    komi: doc.komi ?? 6.5,
    handicap: doc.handicap ?? handicapStones.length,
    free_handicap_placement: false,
    initial_state: { black: initialBlack, white: '' },
    initial_player: handicapStones.length > 0 ? 'white' : 'black',
    players: {
      black: { id: BLACK_ID, username: doc.blackName ?? null },
      white: { id: WHITE_ID, username: doc.whiteName ?? null }
    },
    moves: packMoves(doc.moves),
    phase: phaseFromStatus(doc.status),
    time_control: toJgofTimeControl(doc.timeControl),
    removed,
    clock: null,
    start_time: Math.round((doc.createdAt ?? Date.now()) / 1000)
  };
  if (winner !== null) gamedata.winner = winner;
  if (outcome !== null) gamedata.outcome = outcome;
  if (doc.endedAt) gamedata.end_time = Math.round(doc.endedAt / 1000);
  return gamedata;
}

function migrateChat(chat) {
  return (chat ?? []).map((entry, index) => {
    if (entry.chat_id) return entry;
    return {
      chat_id: `legacy-${index}-${entry.t ?? 0}`,
      username: entry.user,
      player_id: 0,
      body: entry.text,
      date: entry.t ? Math.round(entry.t / 1000) : null,
      move_number: 0,
      channel: 'main'
    };
  });
}

const LEGACY_FIELDS = [
  'size',
  'blackName',
  'whiteName',
  'blackIsAuth',
  'whiteIsAuth',
  'moves',
  'handicap',
  'handicapStones',
  'komi',
  'timeControl',
  'clockState',
  'consecutivePasses',
  'deadStones',
  'corrActiveColor',
  'corrTurnDeadline',
  'scoringActive',
  'scoringBlackApproved',
  'scoringWhiteApproved'
];

async function migrate() {
  const client = new MongoClient(MONGO_URL);
  await client.connect();
  const games = client.db(DB_NAME).collection('games');

  const legacyDocs = await games.find({ gamedata: null, gameType: { $ne: 'ogs' } }).toArray();
  const ogsLegacyDocs = await games.find({ gamedata: { $exists: false } }).toArray();
  const legacyChatDocs = await games
    .find({ chat: { $elemMatch: { chat_id: { $exists: false } } } })
    .toArray();

  const docsById = new Map();
  for (const doc of [...legacyDocs, ...ogsLegacyDocs, ...legacyChatDocs]) {
    docsById.set(doc._id, doc);
  }
  const toMigrate = [...docsById.values()];

  let migrated = 0;
  for (const doc of toMigrate) {
    const isOgsBacked = doc.gameType === 'ogs' || (doc.gameType === 'uploaded' && doc.ogsGameId);
    const patch = { chat: migrateChat(doc.chat) };
    if (!isOgsBacked) {
      patch.gamedata = buildGamedata(doc);
    }
    const unset = Object.fromEntries(LEGACY_FIELDS.map((field) => [field, '']));
    await games.updateOne({ _id: doc._id }, { $set: patch, $unset: unset });
    migrated++;
  }

  console.log(`migrated ${migrated} of ${toMigrate.length} legacy game documents`);
  await client.close();
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
