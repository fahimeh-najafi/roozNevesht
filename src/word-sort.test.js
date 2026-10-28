import test from 'node:test';
import assert from 'node:assert/strict';
import { sortWords } from './word-sort.js';

const word = (id, norsk = '', english = '', farsi = '') => ({ id, norsk, english, farsi });
const ids = (words) => words.map((entry) => entry.id);

for (const [field, entries, expected] of [
  ['english', [word(1, '', ' zebra '), word(2, '', 'Apple'), word(3, '', 'banana')], [2, 3, 1]],
  ['norsk', [word(1, '\u00e5l'), word(2, '\u00f8rn'), word(3, 'zebra'), word(4, '\u00e6rfugl')], [3, 4, 2, 1]],
  ['farsi', [word(1, '', '', '\u067e'), word(2, '', '', '\u062a'), word(3, '', '', '\u0628'), word(4, '', '', '\u0627')], [4, 3, 1, 2]],
]) {
  test(`${field} sorts alphabetically in both directions without changing translations or source order`, () => {
    const original = [...entries];
    const ascending = sortWords(entries, field, 'ascending');
    assert.deepEqual(ids(ascending), expected);
    assert.deepEqual(ids(sortWords(entries, field, 'descending')), [...expected].reverse());
    assert.deepEqual(entries, original);
    for (const entry of ascending) assert.equal(entry, entries.find((source) => source.id === entry.id));
  });
}

test('empty translations stay last and equivalent values retain their original order', () => {
  const entries = [word(1), word(2, '', 'apple'), word(3, '', 'Apple'), word(4, '', '  '), word(5, '', 'zebra')];
  assert.deepEqual(ids(sortWords(entries, 'english', 'ascending')), [2, 3, 5, 1, 4]);
  assert.deepEqual(ids(sortWords(entries, 'english', 'descending')), [5, 2, 3, 1, 4]);
});

test('empty and single-word books can be sorted', () => {
  assert.deepEqual(sortWords([], 'norsk', 'ascending'), []);
  const entries = [word(1, 'ord')];
  assert.deepEqual(sortWords(entries, 'farsi', 'descending'), entries);
});
