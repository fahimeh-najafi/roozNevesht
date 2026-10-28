import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { createApp } from './app.js';

async function start(databasePath, resource = 'notes') {
  const allowedHosts = [];
  const server = createApp({ databasePath, publicDirectory: '.', allowedHosts });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  allowedHosts.push(`127.0.0.1:${server.address().port}`);
  const request = async (path = '', method = 'GET', body, headers = {}) => fetch(`http://127.0.0.1:${server.address().port}/api/${resource}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { request, close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())) };
}

test('word book preserves translations across restarts and supports editing and deletion', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'daybook-words-'));
  const databasePath = join(directory, 'notes.sqlite');
  let app = await start(databasePath, 'words');
  try {
    const word = { norsk: 'hei', english: 'hello', farsi: '\u0633\u0644\u0627\u0645' };
    const response = await app.request('', 'POST', word);
    assert.equal(response.status, 201);
    const saved = (await response.json()).word;
    assert.deepEqual(saved, { id: saved.id, ...word });
    await app.close();
    app = await start(databasePath, 'words');
    assert.deepEqual((await (await app.request()).json()).words, [saved]);
    const edited = { ...word, norsk: 'hallo' };
    assert.deepEqual((await (await app.request(`/${saved.id}`, 'PUT', edited)).json()).word, { id: saved.id, ...edited });
    assert.equal((await app.request(`/${saved.id}`, 'DELETE')).status, 200);
    await app.close();
    app = await start(databasePath, 'words');
    assert.deepEqual((await (await app.request()).json()).words, []);
  } finally {
    await app.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test('all word book fields are optional when adding and editing entries', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'daybook-words-'));
  const app = await start(join(directory, 'notes.sqlite'), 'words');
  try {
    const empty = { norsk: '', english: '', farsi: '' };
    for (const word of [empty, { ...empty, norsk: 'hei' }, { ...empty, english: 'hello' }, { ...empty, farsi: '\u0633\u0644\u0627\u0645' }, { ...empty, norsk: ' ' }]) {
      const response = await app.request('', 'POST', word);
      assert.equal(response.status, 201);
      const saved = (await response.json()).word;
      for (const field of ['norsk', 'english', 'farsi']) assert.equal(saved[field], word[field].trim());
      const edited = await app.request(`/${saved.id}`, 'PUT', empty);
      assert.equal(edited.status, 200);
      assert.deepEqual((await edited.json()).word, { id: saved.id, ...empty });
    }
    const words = (await (await app.request()).json()).words;
    assert.equal(words.length, 5);
    assert.ok(words.every(({ norsk, english, farsi }) => norsk === '' && english === '' && farsi === ''));
  } finally {
    await app.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test('word book rejects invalid input, missing IDs, and cross-site changes', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'daybook-words-'));
  const app = await start(join(directory, 'notes.sqlite'), 'words');
  try {
    const word = { norsk: 'bok', english: 'book', farsi: '\u06a9\u062a\u0627\u0628' };
    for (const invalid of [null, {}, { ...word, english: 12 }, { ...word, farsi: 'a'.repeat(501) }]) {
      assert.equal((await app.request('', 'POST', invalid)).status, 400);
    }
    assert.equal((await app.request('', 'POST', word, { Origin: 'https://other.example' })).status, 403);
    assert.equal((await app.request('', 'POST', word, { 'Content-Type': 'text/plain' })).status, 415);
    assert.equal((await app.request('/1', 'PUT', word)).status, 404);
    assert.equal((await app.request('/1', 'DELETE')).status, 404);
    assert.deepEqual((await (await app.request()).json()).words, []);
  } finally {
    await app.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test('database notes survive server restart, import never overwrites, and deletion persists', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'daybook-'));
  const databasePath = join(directory, 'notes.sqlite');
  let app = await start(databasePath);
  try {
    const note = { title: 'A real page', body: 'Saved in SQLite.' };
    assert.equal((await app.request('/2026-10-27', 'PUT', note)).status, 200);
    await app.close();
    app = await start(databasePath);
    let data = await (await app.request()).json();
    assert.equal(data.notes['2026-10-27'].body, note.body);
    const imported = await app.request('/import', 'POST', { notes: { '2026-10-27': { title: 'Old draft', body: 'Do not overwrite' }, '2026-10-26': note } });
    assert.equal(imported.status, 200);
    data = await imported.json();
    assert.equal(data.notes['2026-10-27'].title, note.title);
    assert.equal(data.notes['2026-10-26'].title, note.title);
    assert.equal((await app.request('/2026-10-27', 'DELETE')).status, 200);
    await app.close();
    app = await start(databasePath);
    data = await (await app.request()).json();
    assert.equal(data.notes['2026-10-27'], undefined);
    assert.equal(data.notes['2026-10-26'].body, note.body);
  } finally {
    await app.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test('invalid input and requests from other sites cannot modify notes', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'daybook-'));
  const app = await start(join(directory, 'notes.sqlite'));
  try {
    assert.equal((await app.request('/2026-02-30', 'PUT', { title: '', body: 'Invalid date' })).status, 400);
    assert.equal((await app.request('/2026-10-27', 'PUT', { title: 12, body: '' })).status, 400);
    assert.equal((await app.request('/2026-10-27', 'PUT', { title: '', body: 'Blocked' }, { Origin: 'https://other.example' })).status, 403);
    assert.equal((await app.request('/2026-10-27', 'PUT', { title: '', body: 'Blocked' }, { 'Content-Type': 'text/plain' })).status, 415);
    assert.equal((await app.request('/import', 'POST', { notes: { '2026-10-27': { title: 'Valid', body: '' }, bad: {} } })).status, 400);
    assert.deepEqual((await (await app.request()).json()).notes, {});
  } finally {
    await app.close();
    await rm(directory, { recursive: true, force: true });
  }
});