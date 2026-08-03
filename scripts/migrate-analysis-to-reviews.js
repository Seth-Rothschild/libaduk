import { MongoClient } from 'mongodb';
import { deserializeTree } from '../src/lib/game/analysisState.svelte.js';
import { collectReviewEntries } from '../src/lib/game/reviewCodec.js';

const MONGO_URL = process.env.MONGO_URL ?? 'mongodb://localhost:27017';
const DB_NAME = process.env.MONGO_DB ?? 'libaduk';

async function migrate() {
  const client = new MongoClient(MONGO_URL);
  await client.connect();
  const db = client.db(DB_NAME);
  const games = db.collection('games');
  const reviews = db.collection('reviews');

  const docs = await games.find({ analysisTree: { $exists: true } }).toArray();

  let migrated = 0;
  for (const doc of docs) {
    const size = doc.gamedata?.width ?? 19;
    const root = deserializeTree(doc.analysisTree, size);
    if (!root) {
      console.warn(`skipping ${doc._id}: could not deserialize analysisTree`);
      continue;
    }
    const entries = collectReviewEntries(root).map((entry) => ({ ...entry, ts: Date.now() }));

    const existingReview = await reviews.findOne({ _id: doc._id });
    if (!existingReview) {
      await reviews.insertOne({
        _id: doc._id,
        gameId: doc._id,
        owners: [],
        entries,
        createdAt: Date.now()
      });
    } else if (existingReview.entries.length === 0) {
      await reviews.updateOne({ _id: doc._id }, { $set: { entries } });
    } else {
      console.warn(`skipping ${doc._id}: review already has entries, not overwriting`);
      continue;
    }

    await games.updateOne(
      { _id: doc._id },
      { $unset: { analysisTree: '', analysisActive: '', currentNodePath: '' } }
    );
    migrated++;
  }

  console.log(`migrated ${migrated} of ${docs.length} analysisTree documents to reviews`);
  await client.close();
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
