import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';

const contentTypes = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };

function validDate(key) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  const date = new Date(`${key}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === key;
}

function validNote(note) {
  return note && typeof note.title === 'string' && note.title.length <= 120 && typeof note.body === 'string' && note.body.length <= 1_000_000;
}

function validWord(word) {
  return word && ['norsk', 'english', 'farsi'].every((field) => typeof word[field] === 'string' && word[field].length <= 500);
}

async function readJson(request) {
  if (!request.headers['content-type']?.startsWith('application/json')) throw Object.assign(new Error('JSON required'), { status: 415 });
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 10_000_000) throw Object.assign(new Error('Request too large'), { status: 413 });
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString());
  } catch {
    throw Object.assign(new Error('Invalid JSON'), { status: 400 });
  }
}

export function createApp({ databasePath, publicDirectory, allowedHosts = ['127.0.0.1:5173', 'localhost:5173'], allowedOrigins = ['http://127.0.0.1:5173', 'http://localhost:5173', 'http://127.0.0.1:5174', 'http://localhost:5174'] }) {
  mkdirSync(dirname(databasePath), { recursive: true });
  const database = new DatabaseSync(databasePath);
  database.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL; PRAGMA busy_timeout = 5000; CREATE TABLE IF NOT EXISTS notes (date TEXT PRIMARY KEY, title TEXT NOT NULL, body TEXT NOT NULL, updated_at TEXT NOT NULL)');
  const allNotes = database.prepare('SELECT date, title, body, updated_at AS updatedAt FROM notes ORDER BY date');
  const upsert = database.prepare('INSERT INTO notes (date, title, body, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(date) DO UPDATE SET title = excluded.title, body = excluded.body, updated_at = excluded.updated_at');
  const insert = database.prepare('INSERT OR IGNORE INTO notes (date, title, body, updated_at) VALUES (?, ?, ?, ?)');
  const remove = database.prepare('DELETE FROM notes WHERE date = ?');
  const getNotes = () => Object.fromEntries(allNotes.all().map(({ date, ...note }) => [date, note]));
  database.exec('CREATE TABLE IF NOT EXISTS words (id INTEGER PRIMARY KEY, norsk TEXT NOT NULL, english TEXT NOT NULL, farsi TEXT NOT NULL)');
  const allWords = database.prepare('SELECT id, norsk, english, farsi FROM words ORDER BY id DESC');
  const insertWord = database.prepare('INSERT INTO words (norsk, english, farsi) VALUES (?, ?, ?) RETURNING id, norsk, english, farsi');
  const updateWord = database.prepare('UPDATE words SET norsk = ?, english = ?, farsi = ? WHERE id = ? RETURNING id, norsk, english, farsi');
  const removeWord = database.prepare('DELETE FROM words WHERE id = ?');
  const root = resolve(publicDirectory);
  const server = createServer(async (request, response) => {
    const json = (status, data) => {
      response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      response.end(JSON.stringify(data));
    };
    try {
      if (!allowedHosts.includes(request.headers.host)) return json(403, { error: 'Host not allowed' });
      if (request.headers.origin && !allowedOrigins.includes(request.headers.origin)) return json(403, { error: 'Origin not allowed' });
      if (request.headers['sec-fetch-site'] === 'cross-site') return json(403, { error: 'Cross-site requests not allowed' });
      const { pathname } = new URL(request.url, 'http://localhost');
      if (pathname === '/api/words' && request.method === 'GET') return json(200, { words: allWords.all() });
      if (pathname === '/api/words' && request.method === 'POST') {
        const word = await readJson(request);
        if (!validWord(word)) return json(400, { error: 'Translations must be text of at most 500 characters each.' });
        return json(201, { word: insertWord.get(word.norsk.trim(), word.english.trim(), word.farsi.trim()) });
      }
      const wordMatch = pathname.match(/^\/api\/words\/([1-9]\d*)$/);
      if (wordMatch && ['PUT', 'DELETE'].includes(request.method)) {
        const id = Number(wordMatch[1]);
        if (!Number.isSafeInteger(id)) return json(400, { error: 'Invalid word ID' });
        if (request.method === 'DELETE') {
          if (!removeWord.run(id).changes) return json(404, { error: 'Word not found' });
          return json(200, { deleted: true });
        }
        const word = await readJson(request);
        if (!validWord(word)) return json(400, { error: 'Translations must be text of at most 500 characters each.' });
        const saved = updateWord.get(word.norsk.trim(), word.english.trim(), word.farsi.trim(), id);
        return saved ? json(200, { word: saved }) : json(404, { error: 'Word not found' });
      }
      if (pathname === '/api/notes' && request.method === 'GET') return json(200, { notes: getNotes() });
      if (pathname === '/api/notes/import' && request.method === 'POST') {
        const payload = await readJson(request);
        if (!payload?.notes || typeof payload.notes !== 'object' || Array.isArray(payload.notes)) return json(400, { error: 'Invalid notes' });
        const entries = Object.entries(payload.notes);
        if (entries.some(([key, note]) => !validDate(key) || !validNote(note))) return json(400, { error: 'Invalid date or note' });
        database.exec('BEGIN IMMEDIATE');
        try {
          for (const [key, note] of entries) insert.run(key, note.title, note.body, new Date().toISOString());
          database.exec('COMMIT');
        } catch (error) {
          database.exec('ROLLBACK');
          throw error;
        }
        return json(200, { notes: getNotes() });
      }
      const match = pathname.match(/^\/api\/notes\/(\d{4}-\d{2}-\d{2})$/);
      if (match && ['PUT', 'DELETE'].includes(request.method)) {
        if (!validDate(match[1])) return json(400, { error: 'Invalid date' });
        if (request.method === 'DELETE') remove.run(match[1]);
        else {
          const note = await readJson(request);
          if (!validNote(note)) return json(400, { error: 'Invalid note' });
          if (!note.title.trim() && !note.body.trim()) remove.run(match[1]);
          else upsert.run(match[1], note.title, note.body, new Date().toISOString());
        }
        return json(200, { saved: true });
      }
      if (pathname.startsWith('/api/')) return json(404, { error: 'Not found' });
      if (!['GET', 'HEAD'].includes(request.method)) return json(405, { error: 'Method not allowed' });
      const file = resolve(root, `.${decodeURIComponent(pathname === '/' ? '/index.html' : pathname)}`);
      if (!file.startsWith(`${root}${sep}`)) return json(403, { error: 'Forbidden' });
      if (!(await stat(file)).isFile()) return json(404, { error: 'Not found' });
      const content = await readFile(file);
      response.writeHead(200, { 'Content-Type': contentTypes[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' });
      response.end(request.method === 'HEAD' ? undefined : content);
    } catch (error) {
      if (error.code === 'ENOENT') return json(404, { error: 'Not found' });
      if (!error.status) console.error(error);
      json(error.status || 500, { error: error.status ? error.message : 'Database or server error' });
    }
  });
  server.on('close', () => database.close());
  return server;
}