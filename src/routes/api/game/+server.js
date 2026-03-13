import { json } from '@sveltejs/kit';
import { createRoom } from '$lib/server/rooms.js';

export async function POST({ request, locals }) {
	const body = await request.json().catch(() => ({}));
	const size = [9, 13, 19].includes(body.size) ? body.size : 19;
	const color = ['black', 'white', 'random'].includes(body.color) ? body.color : 'random';
	const timeControl = body.timeControl ?? { type: 'none' };
	const room = createRoom(size, timeControl, color);
	return json({ gameId: room.id });
}
