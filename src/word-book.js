import { createIcons, Asterisk, ArrowLeft, Plus, Save, Trash2, RefreshCw, Delete, X, Space, Ellipsis, Pencil } from 'lucide';
import '@fontsource/vazirmatn/400.css';
import '@fontsource/vazirmatn/600.css';
import './style.css';
import './word-book.css';

const icons = { Asterisk, ArrowLeft, Plus, Save, Trash2, RefreshCw, Delete, X, Space, Ellipsis, Pencil };
const element = (id) => document.getElementById(id);
const fields = ['norsk', 'english', 'farsi'];
let words = [];
let deletion = null;
let keyboardInput = null;
let pointerNavigation = false;

const keyboard = document.createElement('section');
keyboard.id = 'persian-keyboard';
keyboard.className = 'persian-keyboard';
keyboard.setAttribute('aria-label', 'Persian keyboard');
keyboard.hidden = true;
keyboard.innerHTML = '<div class="persian-keyboard-header"><h2>Persian keyboard</h2><button type="button" class="icon-button" data-key="close" title="Close Persian keyboard" aria-label="Close Persian keyboard"><i data-lucide="x"></i></button></div>';
const keyRows = [
  '\u06f1 \u06f2 \u06f3 \u06f4 \u06f5 \u06f6 \u06f7 \u06f8 \u06f9 \u06f0',
  '\u0636 \u0635 \u062b \u0642 \u0641 \u063a \u0639 \u0647 \u062e \u062d \u062c \u0686',
  '\u0634 \u0633 \u06cc \u0628 \u0644 \u0627 \u062a \u0646 \u0645 \u06a9 \u06af',
  '\u0638 \u0637 \u0632 \u0631 \u0630 \u062f \u067e \u0648 \u0698',
  '\u0622 \u0621 \u0626 \u0624 \u0623 \u0625 \u0629 \u0654 \u060c \u061b \u061f .',
];
for (const letters of keyRows) {
  const row = document.createElement('div');
  row.className = 'persian-keyboard-row';
  for (const letter of letters.split(' ')) {
    const key = document.createElement('button');
    key.type = 'button';
    key.className = 'persian-key';
    key.dataset.key = letter;
    key.lang = 'fa';
    key.textContent = letter;
    row.append(key);
  }
  keyboard.append(row);
}
const keyboardTools = document.createElement('div');
keyboardTools.className = 'persian-keyboard-row persian-keyboard-tools';
keyboardTools.innerHTML = '<button type="button" class="persian-key" data-key="\u200c" title="Half-space (zero-width non-joiner)" aria-label="Half-space">\u200c<span lang="fa">&#x646;&#x6cc;&#x645;&#x200c;&#x641;&#x627;&#x635;&#x644;&#x647;</span></button><button type="button" class="persian-key persian-space" data-key=" " title="Space" aria-label="Space"><i data-lucide="space"></i></button><button type="button" class="persian-key" data-key="backspace" title="Backspace" aria-label="Backspace"><i data-lucide="delete"></i></button>';
keyboard.append(keyboardTools);
document.body.append(keyboard);

function closeKeyboard() {
  keyboard.hidden = true;
  if (keyboardInput) keyboardInput.setAttribute('aria-expanded', 'false');
  keyboardInput = null;
  document.documentElement.classList.remove('persian-keyboard-open');
}

function openKeyboard(input) {
  if (input.disabled || input.readOnly) return;
  if (keyboardInput && keyboardInput !== input) keyboardInput.setAttribute('aria-expanded', 'false');
  keyboardInput = input;
  input.setAttribute('aria-controls', keyboard.id);
  input.setAttribute('aria-expanded', 'true');
  keyboard.hidden = false;
  document.documentElement.classList.add('persian-keyboard-open');
  document.documentElement.style.setProperty('--persian-keyboard-height', `${keyboard.offsetHeight + 20}px`);
  input.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

document.addEventListener('focusin', (event) => {
  if (event.target.matches('input[lang="fa"]')) {
    if (!pointerNavigation) openKeyboard(event.target);
  }
  else if (!pointerNavigation && !keyboard.contains(event.target)) closeKeyboard();
});
document.addEventListener('click', (event) => {
  if (event.target.matches('input[lang="fa"]')) openKeyboard(event.target);
  else if (!keyboard.contains(event.target)) closeKeyboard();
  pointerNavigation = false;
});
document.addEventListener('pointerdown', () => {
  pointerNavigation = true;
});
document.addEventListener('pointerup', () => {
  requestAnimationFrame(() => { pointerNavigation = false; });
});
document.addEventListener('pointercancel', () => {
  pointerNavigation = false;
});
keyboard.addEventListener('pointerdown', (event) => {
  if (event.target.closest('button')) event.preventDefault();
});
keyboard.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-key]');
  if (!button || !keyboardInput) return;
  const input = keyboardInput;
  if (button.dataset.key === 'close') {
    input.focus({ preventScroll: true });
    closeKeyboard();
    return;
  }
  if (!input.isConnected || input.disabled) return closeKeyboard();
  const backspace = button.dataset.key === 'backspace';
  let start = input.selectionStart;
  const end = input.selectionEnd;
  const text = backspace ? '' : button.dataset.key;
  if (backspace && start === end) start = Math.max(0, start - 1);
  if (input.maxLength >= 0 && input.value.length - (end - start) + text.length > input.maxLength) return;
  input.setRangeText(text, start, end, 'end');
  input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: backspace ? 'deleteContentBackward' : 'insertText', data: backspace ? null : text }));
  input.focus({ preventScroll: true });
});
document.addEventListener('keydown', (event) => {
  const menu = document.querySelector('.word-menu:popover-open');
  if (event.key === 'Escape' && menu) {
    event.preventDefault();
    menu.hidePopover();
    menu.parentElement.querySelector('.word-more').focus();
    return;
  }
  if (event.key !== 'Escape' || keyboard.hidden) return;
  event.preventDefault();
  keyboardInput?.focus({ preventScroll: true });
  closeKeyboard();
});
window.addEventListener('resize', () => {
  if (keyboardInput) openKeyboard(keyboardInput);
});

function status(message, error = false) {
  element('word-status').textContent = message;
  element('word-status').classList.toggle('save-error', error);
}

async function request(path = '', method = 'GET', body) {
  const response = await fetch(`/api/words${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function updateCount() {
  element('word-total').textContent = `${words.length} ${words.length === 1 ? 'word' : 'words'}`;
  element('words-empty').hidden = words.length !== 0;
}

function setBusy(row, busy) {
  for (const control of row.querySelectorAll('input, button')) control.disabled = busy;
}

function renderWord(word) {
  const label = word.norsk || word.english || word.farsi || 'Untitled word';
  const row = document.createElement('tr');
  row.dataset.id = word.id;
  const inputs = {};
  for (const field of fields) {
    const cell = document.createElement('td');
    const input = document.createElement('input');
    input.value = word[field];
    input.readOnly = true;
    input.maxLength = 500;
    input.lang = field === 'farsi' ? 'fa' : field === 'norsk' ? 'nb' : 'en';
    if (field === 'farsi') {
      input.dir = 'rtl';
      input.inputMode = 'none';
    }
    input.setAttribute('aria-label', `${field} translation for ${label}`);
    input.addEventListener('input', () => {
      row.dataset.dirty = String(fields.some((name) => inputs[name].value !== word[name]));
      status('Unsaved changes');
    });
    inputs[field] = input;
    cell.append(input);
    row.append(cell);
  }
  const controls = document.createElement('div');
  controls.className = 'word-row-actions';
  controls.hidden = true;
  const menu = document.createElement('div');
  menu.id = `word-menu-${word.id}`;
  menu.className = 'word-menu';
  menu.popover = 'auto';
  menu.setAttribute('aria-label', `Actions for ${label}`);
  const more = document.createElement('button');
  more.type = 'button';
  more.className = 'icon-button word-more';
  more.title = 'Word actions';
  more.setAttribute('aria-label', `Actions for ${label}`);
  more.setAttribute('aria-expanded', 'false');
  more.setAttribute('aria-controls', menu.id);
  more.popoverTargetElement = menu;
  more.innerHTML = '<i data-lucide="ellipsis"></i>';
  menu.addEventListener('toggle', () => {
    const open = menu.matches(':popover-open');
    more.setAttribute('aria-expanded', String(open));
    if (!open) return;
    const bounds = more.getBoundingClientRect();
    menu.style.left = `${Math.max(8, Math.min(bounds.right - menu.offsetWidth, window.innerWidth - menu.offsetWidth - 8))}px`;
    menu.style.top = `${Math.max(8, Math.min(bounds.bottom + 4, window.innerHeight - menu.offsetHeight - 8))}px`;
  });
  const edit = document.createElement('button');
  edit.type = 'button';
  edit.innerHTML = '<i data-lucide="pencil"></i>Edit';
  edit.addEventListener('click', () => {
    menu.hidePopover();
    for (const input of Object.values(inputs)) input.readOnly = false;
    controls.hidden = false;
    edit.disabled = true;
    row.classList.add('word-editing');
    inputs.norsk.focus();
  });
  const save = document.createElement('button');
  save.className = 'icon-button';
  save.title = 'Save word';
  save.setAttribute('aria-label', `Save ${label}`);
  save.innerHTML = '<i data-lucide="save"></i>';
  save.addEventListener('click', async () => {
    if (!fields.every((field) => inputs[field].reportValidity())) return;
    setBusy(row, true);
    status('Saving...');
    try {
      const payload = Object.fromEntries(fields.map((field) => [field, inputs[field].value]));
      const data = await request(`/${word.id}`, 'PUT', payload);
      words = words.map((entry) => entry.id === word.id ? data.word : entry);
      const replacement = renderWord(data.word);
      row.replaceWith(replacement);
      createIcons({ icons });
      replacement.querySelector('.word-more').focus();
      status('Saved to database');
    } catch {
      status('Could not save. Your changes are still here; try saving again.', true);
    } finally {
      setBusy(row, false);
    }
  });
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.title = 'Delete word';
  remove.setAttribute('aria-label', `Delete ${label}`);
  remove.innerHTML = '<i data-lucide="trash-2"></i>Delete';
  remove.addEventListener('click', () => {
    menu.hidePopover();
    deletion = { word, row };
    element('delete-word-name').textContent = label;
    element('delete-word-dialog').showModal();
  });
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'icon-button';
  cancel.title = 'Cancel editing';
  cancel.setAttribute('aria-label', `Cancel editing ${label}`);
  cancel.innerHTML = '<i data-lucide="x"></i>';
  cancel.addEventListener('click', () => {
    closeKeyboard();
    menu.hidePopover();
    const replacement = renderWord(word);
    row.replaceWith(replacement);
    createIcons({ icons });
    replacement.querySelector('.word-more').focus();
    status(document.querySelector('[data-dirty="true"]') ? 'Unsaved changes' : 'Saved to database');
  });
  controls.append(save, cancel);
  menu.append(edit, remove);
  row.firstElementChild.append(controls);
  row.lastElementChild.classList.add('word-action-cell');
  row.lastElementChild.append(more, menu);
  return row;
}

async function load() {
  element('retry-words').hidden = true;
  status('Connecting...');
  try {
    words = (await request()).words;
    element('word-rows').replaceChildren(...words.map(renderWord));
    for (const control of document.querySelectorAll('[form="add-word"]')) control.disabled = false;
    updateCount();
    status('Saved to database');
    createIcons({ icons });
  } catch {
    status('Could not load Word Book. Check that the server is running.', true);
    element('retry-words').hidden = false;
  }
}

element('add-word').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const payload = Object.fromEntries(new FormData(form));
  const row = document.querySelector('.word-entry tr');
  setBusy(row, true);
  status('Saving...');
  try {
    const { word } = await request('', 'POST', payload);
    words.unshift(word);
    element('word-rows').prepend(renderWord(word));
    form.reset();
    updateCount();
    createIcons({ icons });
    status('Saved to database');
  } catch {
    status('Could not add word. Your translations are still here; try again.', true);
  } finally {
    setBusy(row, false);
    element('new-norsk').focus();
  }
});

element('keep-word').addEventListener('click', () => element('delete-word-dialog').close());
element('confirm-delete-word').addEventListener('click', async () => {
  if (!deletion) return;
  const { word, row } = deletion;
  element('confirm-delete-word').disabled = true;
  element('keep-word').disabled = true;
  setBusy(row, true);
  try {
    await request(`/${word.id}`, 'DELETE');
    words = words.filter((entry) => entry.id !== word.id);
    row.remove();
    updateCount();
    status('Word deleted');
  } catch {
    status('Could not delete word. Try again.', true);
  } finally {
    setBusy(row, false);
    element('confirm-delete-word').disabled = false;
    element('keep-word').disabled = false;
    element('delete-word-dialog').close();
    deletion = null;
  }
});
element('retry-words').addEventListener('click', load);
window.addEventListener('beforeunload', (event) => {
  const newWord = fields.some((field) => element(`new-${field}`).value);
  if (!newWord && !document.querySelector('[data-dirty="true"]')) return;
  event.preventDefault();
  event.returnValue = '';
});
createIcons({ icons });
void load();