import test from 'node:test';
import assert from 'node:assert/strict';
import { NotesStore } from './notes-store.js';

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}

test('default fetch keeps the global receiver and saves recovered browser drafts', async (context) => {
  const note = { title: 'Recovered', body: 'Browser draft' };
  const writes = [];
  context.mock.method(globalThis, 'fetch', async function (url, options) {
    assert.equal(this, globalThis);
    if (options.method === 'PUT') writes.push(JSON.parse(options.body));
    return { ok: true, json: async () => ({ notes: {} }) };
  });
  const storage = memoryStorage({
    'daybook.database-imported.v1': 'true',
    'daybook.pending.v1': JSON.stringify({ '2026-10-27': note }),
  });
  const store = new NotesStore({ storage });
  await store.initialize();
  assert.equal(store.ready, true);
  assert.equal(store.error, false);
  assert.deepEqual(writes, [note]);
  assert.deepEqual(store.pending, {});
});

test('legacy notes are imported once and database data becomes the source of truth', async () => {
  const note = { title: 'Old browser note', body: 'Keep me' };
  const storage = memoryStorage({ 'daybook.notes.v1': JSON.stringify({ '2026-10-27': note }) });
  let imports = 0;
  const request = async (url) => {
    if (url.endsWith('/import')) imports += 1;
    return { ok: true, json: async () => ({ notes: { '2026-10-27': note } }) };
  };
  const store = new NotesStore({ storage, request });
  await store.initialize();
  assert.equal(store.ready, true);
  assert.equal(imports, 1);
  await store.initialize();
  assert.equal(imports, 1);
  assert.equal(store.notes['2026-10-27'].body, 'Keep me');
});

test('failed writes survive reload as drafts and retry into the database', async () => {
  const storage = memoryStorage({ 'daybook.database-imported.v1': 'true' });
  let offline = false;
  const written = [];
  const request = async (url, options) => {
    if (offline) throw new Error('Offline');
    if (options.method === 'PUT') written.push(JSON.parse(options.body));
    return { ok: true, json: async () => ({ notes: {} }) };
  };
  const store = new NotesStore({ storage, request });
  await store.initialize();
  offline = true;
  store.set('2026-10-27', { title: 'Draft', body: 'Not lost' });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(store.error, true);
  assert.equal(Object.keys(store.pending).length, 1);
  const restored = new NotesStore({ storage, request });
  assert.equal(restored.notes['2026-10-27'].body, 'Not lost');
  offline = false;
  await restored.initialize();
  assert.equal(restored.error, false);
  assert.equal(Object.keys(restored.pending).length, 0);
  assert.equal(written[0].body, 'Not lost');
});

test('an edit arriving during a save is not acknowledged by the older response', async () => {
  const storage = memoryStorage({ 'daybook.database-imported.v1': 'true' });
  let release;
  const writes = [];
  const request = async (url, options) => {
    if (options.method === 'PUT') {
      writes.push(JSON.parse(options.body));
      if (writes.length === 1) await new Promise((resolve) => { release = resolve; });
    }
    return { ok: true, json: async () => ({ notes: {} }) };
  };
  const store = new NotesStore({ storage, request });
  await store.initialize();
  store.set('2026-10-27', { title: '', body: 'First' });
  store.set('2026-10-27', { title: '', body: 'Second' });
  release();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(writes.map((note) => note.body), ['First', 'Second']);
  assert.equal(Object.keys(store.pending).length, 0);
});