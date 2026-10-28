import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, mkdir, copyFile, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('supervisor replaces a reused PID, rejects duplicate launchers, and restarts a clean exit', { timeout: 30000 }, async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'daybook-supervisor-'));
  await mkdir(join(root, 'server'));
  await mkdir(join(root, 'data'));
  await writeFile(join(root, 'package.json'), '{"type":"module"}');
  await copyFile(new URL('./supervisor.js', import.meta.url), join(root, 'server', 'supervisor.js'));
  await writeFile(join(root, 'data', 'background.pid'), String(process.pid));
  await writeFile(join(root, 'server', 'index.js'), `
    import { appendFileSync } from 'node:fs';
    appendFileSync(new URL('../data/launches', import.meta.url), 'started\\n');
  `);
  const child = spawn(process.execPath, [join(root, 'server', 'supervisor.js')], { stdio: ['ignore', 'pipe', 'pipe'] });
  let errors = '';
  child.stderr.on('data', (data) => { errors += data; });
  context.after(async () => {
    if (child.exitCode === null) {
      const exited = once(child, 'exit');
      child.kill();
      await exited;
    }
    await rm(root, { recursive: true, force: true });
  });
  await context.waitFor(async () => {
    assert.equal(child.exitCode, null, errors);
    const launches = await readFile(join(root, 'data', 'launches'), 'utf8');
    assert.ok(launches.trim().split('\n').length >= 2);
  }, { interval: 100, timeout: 20000 });
  assert.equal(Number(await readFile(join(root, 'data', 'background.pid'), 'utf8')), child.pid);
  const duplicate = execFileSync(process.execPath, [join(root, 'server', 'supervisor.js')], { encoding: 'utf8', timeout: 20000 });
  assert.match(duplicate, /already running/);
  assert.equal(Number(await readFile(join(root, 'data', 'background.pid'), 'utf8')), child.pid);
});