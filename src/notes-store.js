import { readNotes } from './calendar.js';

const cacheKey = 'daybook.notes.v1';
const pendingKey = 'daybook.pending.v1';
const migratedKey = 'daybook.database-imported.v1';

export class NotesStore {
  constructor({ storage, request = (...args) => globalThis.fetch(...args), onChange = () => {} }) {
    this.storage = storage;
    this.request = request;
    this.onChange = onChange;
    this.notes = {};
    this.pending = {};
    this.ready = false;
    this.loading = true;
    this.connecting = false;
    this.saving = false;
    this.error = false;
    this.cacheError = false;
    this.migrated = false;
    try {
      this.notes = readNotes(storage.getItem(cacheKey));
      this.migrated = storage.getItem(migratedKey) === 'true';
      const pending = JSON.parse(storage.getItem(pendingKey) || '{}');
      if (!pending || typeof pending !== 'object' || Array.isArray(pending)) throw new Error('Invalid drafts');
      for (const [key, note] of Object.entries(pending)) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || (note !== null && !readNotes(JSON.stringify({ [key]: note }))[key])) throw new Error('Invalid draft');
      }
      this.pending = pending;
    } catch {
      this.cacheError = true;
    }
    this.legacyNotes = { ...this.notes };
    this.mergePending();
  }

  mergePending() {
    for (const [key, note] of Object.entries(this.pending)) {
      if (note === null) delete this.notes[key];
      else this.notes[key] = note;
    }
  }

  cache() {
    try {
      this.storage.setItem(pendingKey, JSON.stringify(this.pending));
      this.storage.setItem(cacheKey, JSON.stringify(this.notes));
      this.cacheError = false;
    } catch {
      this.cacheError = true;
    }
  }

  async api(path = '', options = {}) {
    const response = await this.request(`/api/notes${path}`, { ...options, headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error(`Database request failed: ${response.status}`);
    return response.json();
  }

  async initialize() {
    if (this.connecting) return;
    this.connecting = true;
    try {
      let data = await this.api();
      if (!this.migrated) {
        if (Object.keys(this.legacyNotes).length) data = await this.api('/import', { method: 'POST', body: JSON.stringify({ notes: this.legacyNotes }) });
        this.migrated = true;
        try {
          this.storage.setItem(migratedKey, 'true');
        } catch {
          this.cacheError = true;
        }
      }
      this.notes = readNotes(JSON.stringify(data.notes));
      this.mergePending();
      this.ready = true;
      this.error = false;
      this.cache();
      this.onChange(true);
    } catch {
      this.error = true;
      this.ready = false;
    } finally {
      this.connecting = false;
      this.loading = false;
      this.onChange(false);
    }
    await this.flush();
  }

  set(key, note) {
    if (note === null) delete this.notes[key];
    else this.notes[key] = note;
    this.pending[key] = note;
    this.cache();
    this.onChange(false);
    void this.flush();
  }

  async flush() {
    if (!this.ready || this.saving) return;
    this.saving = true;
    this.onChange(false);
    try {
      while (Object.keys(this.pending).length) {
        const [key, note] = Object.entries(this.pending)[0];
        await this.api(`/${key}`, note === null ? { method: 'DELETE' } : { method: 'PUT', body: JSON.stringify(note) });
        if (this.pending[key] === note) delete this.pending[key];
        this.cache();
      }
      this.error = false;
    } catch {
      this.ready = false;
      this.error = true;
    } finally {
      this.saving = false;
      this.onChange(false);
    }
  }
}