import { resetDb, seedTestPuzzle } from './helpers.js';

export default async function globalSetup() {
  await resetDb();
  await seedTestPuzzle();
}
