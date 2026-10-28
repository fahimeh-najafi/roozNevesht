import { createIcons, Asterisk, Download, Search, ChevronLeft, ChevronRight, BookOpen, Trash2, X, Check } from 'lucide';
import { dateKey, parseDate, monthDays } from './calendar.js';
import { NotesStore } from './notes-store.js';
import './style.css';

const icons = { Asterisk, Download, Search, ChevronLeft, ChevronRight, BookOpen, Trash2, X, Check };
const element = (id) => document.getElementById(id);
const today = new Date();
let selected = dateKey(today);
let visible = new Date(today.getFullYear(), today.getMonth(), 1, 12);
const store = new NotesStore({
  storage: {
    getItem: (key) => localStorage.getItem(key),
    setItem: (key, value) => localStorage.setItem(key, value),
  },
  onChange: (reload) => {
    notes = store.notes;
    if (reload) selectDay(selected, false);
    else {
      updateEditorStatus();
      renderCalendar();
    }
  },
});
let notes = store.notes;

function renderCalendar() {
  element('month-heading').textContent = visible.toLocaleDateString('en', { month: 'long' });
  element('year-label').textContent = visible.getFullYear();
  element('calendar').replaceChildren();
  for (const date of monthDays(visible.getFullYear(), visible.getMonth())) {
    const key = dateKey(date);
    const note = notes[key];
    const button = document.createElement('button');
    button.className = `day${date.getMonth() !== visible.getMonth() ? ' outside' : ''}${key === selected ? ' selected' : ''}${key === dateKey(today) ? ' is-today' : ''}${note ? ' has-note' : ''}`;
    button.setAttribute('aria-label', `${date.toLocaleDateString('en', { dateStyle: 'full' })}${note ? ', has note' : ''}`);
    button.setAttribute('aria-pressed', String(key === selected));
    if (key === dateKey(today)) button.setAttribute('aria-current', 'date');
    const number = document.createElement('span');
    number.className = 'day-number';
    number.textContent = date.getDate();
    button.append(number);
    if (key === dateKey(today)) {
      const label = document.createElement('span');
      label.className = 'today-label';
      label.textContent = 'Today';
      button.append(label);
    }
    if (note) {
      const preview = document.createElement('span');
      preview.className = 'day-preview';
      preview.textContent = note.title || note.body.trim().split('\n')[0];
      const dot = document.createElement('span');
      dot.className = 'note-dot';
      button.append(preview, dot);
    }
    button.addEventListener('click', () => selectDay(key));
    element('calendar').append(button);
  }
}

function selectDay(key, openPanel = true) {
  selected = key;
  const date = parseDate(key);
  visible = new Date(date.getFullYear(), date.getMonth(), 1, 12);
  element('note-weekday').textContent = date.toLocaleDateString('en', { weekday: 'long' });
  element('note-date').textContent = date.toLocaleDateString('en', { month: 'long', day: 'numeric' });
  element('relative-date').textContent = key === dateKey(today) ? 'Today' : date.getFullYear();
  element('note-title').value = notes[key]?.title || '';
  element('note-body').value = notes[key]?.body || '';
  element('note-title').placeholder = key === dateKey(today) ? 'Give today a title...' : 'Give this day a title...';
  if (openPanel) document.body.classList.add('note-open');
  updateEditorStatus();
  renderCalendar();
}

function updateEditorStatus() {
  const text = `${element('note-title').value} ${element('note-body').value}`.trim();
  const count = text ? text.split(/\s+/).length : 0;
  element('word-count').textContent = `${count} ${count === 1 ? 'word' : 'words'}`;
  const status = store.loading ? 'Connecting...' : store.error ? (store.cacheError ? 'Not saved. Export a backup.' : 'Database offline. Draft kept here.') : store.saving || Object.keys(store.pending).length ? 'Saving...' : 'Saved to database';
  element('save-status').textContent = status;
  element('save-status').classList.toggle('save-error', store.error);
  element('note-title').disabled = store.loading;
  element('note-body').disabled = store.loading;
  element('delete-note').disabled = store.loading || !notes[selected];
  createIcons({ icons });
}

function saveNote() {
  const title = element('note-title').value;
  const body = element('note-body').value;
  store.set(selected, title.trim() || body.trim() ? { title, body, updatedAt: new Date().toISOString() } : null);
}

for (const id of ['note-title', 'note-body']) element(id).addEventListener('input', saveNote);
element('previous').addEventListener('click', () => {
  visible = new Date(visible.getFullYear(), visible.getMonth() - 1, 1, 12);
  renderCalendar();
});
element('next').addEventListener('click', () => {
  visible = new Date(visible.getFullYear(), visible.getMonth() + 1, 1, 12);
  renderCalendar();
});
element('today').addEventListener('click', () => selectDay(dateKey(new Date()), false));
element('close-note').addEventListener('click', () => {
  document.body.classList.remove('note-open');
  element('calendar').querySelector('.selected')?.focus();
});
element('delete-note').addEventListener('click', () => element('delete-dialog').showModal());
element('delete-cancel').addEventListener('click', () => element('delete-dialog').close());
element('delete-confirm').addEventListener('click', () => {
  element('note-title').value = '';
  element('note-body').value = '';
  store.set(selected, null);
  element('delete-dialog').close();
});
element('export').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify({ app: 'daybook', exportedAt: new Date().toISOString(), notes }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `daybook-${dateKey(new Date())}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

function searchNotes() {
  const query = element('search-input').value.trim().toLowerCase();
  const matches = Object.entries(notes).filter(([key, note]) => `${key} ${parseDate(key).toLocaleDateString('en', { dateStyle: 'full' })} ${note.title} ${note.body}`.toLowerCase().includes(query)).sort(([first], [second]) => second.localeCompare(first));
  element('search-results').replaceChildren();
  if (!matches.length) {
    const empty = document.createElement('p');
    empty.className = 'search-empty';
    empty.textContent = query ? 'No pages found for that thought.' : 'Your stories will find a home here.';
    element('search-results').append(empty);
  }
  for (const [key, note] of matches) {
    const result = document.createElement('button');
    result.className = 'search-result';
    const date = document.createElement('span');
    date.textContent = parseDate(key).toLocaleDateString('en', { dateStyle: 'medium' });
    const title = document.createElement('strong');
    title.textContent = note.title || note.body.slice(0, 100);
    result.append(date, title);
    result.addEventListener('click', () => {
      selectDay(key);
      element('search-dialog').close();
    });
    element('search-results').append(result);
  }
}
element('search-open').addEventListener('click', () => {
  element('search-input').value = '';
  searchNotes();
  element('search-dialog').showModal();
  element('search-input').focus();
});
element('search-close').addEventListener('click', () => element('search-dialog').close());
element('search-input').addEventListener('input', searchNotes);
for (const dialog of document.querySelectorAll('dialog')) {
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) {
      const bounds = dialog.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
    }
  });
}
selectDay(selected, false);
void store.initialize();
setInterval(() => {
  if (!store.ready) void store.initialize();
  else void store.flush();
}, 5000);
window.addEventListener('beforeunload', (event) => {
  if (!Object.keys(store.pending).length) return;
  event.preventDefault();
  event.returnValue = '';
});