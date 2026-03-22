import { resetDb } from './helpers.js';

export default async function globalSetup() {
  await resetDb();
}
