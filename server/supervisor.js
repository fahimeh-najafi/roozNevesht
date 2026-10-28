import { spawn } from 'node:child_process';
import { mkdirSync, openSync, readFileSync, writeFileSync, unlinkSync, closeSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const directory = resolve(root, 'data');
const pidFile = resolve(directory, 'background.pid');
mkdirSync(directory, { recursive: true });
if (readPid()) {
  console.log('Daybook background launcher is already running.');
  process.exit(0);
}
const lock = openSync(pidFile, 'wx');
writeFileSync(lock, String(process.pid));
closeSync(lock);
let child;
let stopping = false;
const log = openSync(resolve(directory, 'server.log'), 'a');

function readPid() {
  try {
    const pid = Number(readFileSync(pidFile, 'utf8'));
    if (!Number.isInteger(pid) || pid <= 0) throw new Error('Invalid PID');
    try {
      process.kill(pid, 0);
      return pid;
    } catch (error) {
      if (error.code !== 'ESRCH') return pid;
    }
  } catch (error) {
    if (error.code === 'ENOENT') return null;
  }
  unlinkSync(pidFile);
  return null;
}

function launch() {
  if (stopping) return;
  child = spawn(process.execPath, [resolve(root, 'server', 'index.js')], { cwd: root, stdio: ['ignore', log, log], windowsHide: true });
  child.on('error', (error) => console.error(error));
  child.on('exit', (code) => {
    if (stopping || code === 0) process.exit(0);
    else setTimeout(launch, 5000);
  });
}

process.on('exit', () => {
  try { unlinkSync(pidFile); } catch {}
  closeSync(log);
});
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    stopping = true;
    if (child) child.kill();
    else process.exit(0);
  });
}
launch();