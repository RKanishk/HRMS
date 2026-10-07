// Isolated development/test helper. Production always uses PostgreSQL and Redis services.
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
if (process.env.NODE_ENV === 'production') throw new Error('Local helper is development-only');
await mkdir('.local-db', { recursive: true });
const databases = [];
const servers = [];
for (const [port, name] of [
  [5432, 'dev'],
  [5433, 'test'],
]) {
  const db = await PGlite.create(`.local-db/${name}`);
  databases.push(db);
  const server = new PGLiteSocketServer({ db, port, host: '127.0.0.1', maxConnections: 30 });
  await server.start();
  servers.push(server);
}
const redis = spawn(
  process.env.HRMS_REDIS_BIN ?? 'redis-server',
  ['--bind', '127.0.0.1', '--port', '6379', '--save', '', '--appendonly', 'no'],
  { stdio: ['ignore', 'ignore', 'inherit'] },
);
await new Promise((resolve, reject) => {
  redis.once('error', reject);
  setTimeout(resolve, 500);
});
const [cmd, ...args] = process.argv.slice(2);
const child = spawn(cmd, args, { stdio: 'inherit', env: process.env });
const code = await new Promise((resolve) => {
  child.once('exit', resolve);
  child.once('error', () => resolve(1));
});
redis.kill('SIGTERM');
for (const server of servers) await server.stop();
for (const db of databases) await db.close();
process.exitCode = Number(code ?? 1);
