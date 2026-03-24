import { getLeaderboards } from '$lib/server/db.js';

export async function load() {
  const leaderboards = await getLeaderboards();
  return { leaderboards };
}
