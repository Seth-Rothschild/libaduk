import { getGame } from '$lib/server/db.js';

export async function load({ url }) {
  const gameId = url.searchParams.get('game');
  if (!gameId) return { game: null };

  const game = await getGame(gameId);
  if (!game) return { game: null };

  return {
    game: {
      size: game.size,
      moves: game.moves ?? []
    }
  };
}
