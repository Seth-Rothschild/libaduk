import { createServer } from 'node:http';
import { connectDb } from './src/lib/server/db.js';
import { handler } from './build/handler.js';
import { attachWebSocketServer } from './src/lib/server/rooms.js';

process.on('uncaughtException', (err) => {
  if (err.code === 'ENOENT' && err.syscall === 'open') {
    console.error(`Missing file: ${err.path}`);
    return;
  }
  console.error('Uncaught exception:', err);
  process.exit(1);
});

const port = process.env.PORT ?? 3000;

await connectDb();

const server = createServer(handler);
attachWebSocketServer(server);

server.listen(port, () => {
  console.log(`Listening on http://localhost:${port}`);
});
