import { createServer } from 'node:http';
import { connectDb } from './src/lib/server/db.js';
import { handler } from './build/handler.js';
import { attachWebSocketServer } from './src/lib/server/rooms.js';

const port = process.env.PORT ?? 3000;

await connectDb();

const server = createServer(handler);
attachWebSocketServer(server);

server.listen(port, () => {
  console.log(`Listening on http://localhost:${port}`);
});
