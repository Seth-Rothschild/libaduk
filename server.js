import { createServer } from 'node:http';
import { handler } from './build/handler.js';
import { attachWebSocketServer } from './rooms.js';

const port = process.env.PORT ?? 3000;

const server = createServer(handler);
attachWebSocketServer(server);

server.listen(port, () => {
	console.log(`Listening on http://localhost:${port}`);
});
