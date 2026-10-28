import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { createApp } from './app.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const databasePath = resolve(root, 'data', 'daybook.sqlite');
const server = createApp({ databasePath, publicDirectory: resolve(root, 'dist') });
server.on('error', (error) => {
  console.error(error.code === 'EADDRINUSE' ? 'Daybook cannot start: port 5173 is already in use.' : error);
  process.exitCode = 1;
});
server.listen(5173, '127.0.0.1', () => {
  console.log('Daybook is running at http://127.0.0.1:5173/');
  console.log(`Database: ${databasePath}`);
});
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}