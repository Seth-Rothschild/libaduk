import { json } from '@sveltejs/kit';
import { createRoom } from '$lib/server/rooms.js';

export async function POST({ request }) {
	const body = await request.json().catch(() => ({}));
	const size = [9, 13, 19].includes(body.size) ? body.size : 19;
	const room = createRoom(size);
	return json({ gameId: room.id });
}
