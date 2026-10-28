import test from 'node:test';
import assert from 'node:assert/strict';
import { filterWords } from './word-search.js';
import { sortWords } from './word-sort.js';

const words = [
  { id: 1, norsk: 'eple', english: 'Apple', farsi: '\u0633\u06cc\u0628' },
  { id: 2, norsk: '\u00e5l', english: 'eel', farsi: '\u0645\u0627\u0631\u0645\u0627\u0647\u06cc' },
  { id: 3, norsk: '', english: 'pineapple', farsi: '' },
];

test('search finds partial matches across all three languages', () => {
  for (const [query, expected] of [['EPL', [1]], [' APPLE ', [1, 3]], ['\u0633\u06cc', [1]], ['\u00c5', [2]]]) {
    assert.deepEqual(filterWords(words, query).map((word) => word.id), expected);
  }
});

test('search treats composed and decomposed letters equally', () => {
  assert.deepEqual(filterWords(words, 'a\u030a'), [words[1]]);
});

test('empty search restores every word and unmatched queries return none', () => {
  assert.deepEqual(filterWords(words, ''), words);
  assert.deepEqual(filterWords(words, '   '), words);
  assert.deepEqual(filterWords(words, 'no match'), []);
  assert.deepEqual(filterWords([], 'apple'), []);
});

test('filtering preserves row identity, source data, and the selected sort order', () => {
  const original = structuredClone(words);
  const sorted = sortWords(words, 'english', 'descending');
  const results = filterWords(sorted, 'apple');
  assert.deepEqual(results.map((word) => word.id), [3, 1]);
  assert.equal(results[0], words[2]);
  assert.equal(results[1], words[0]);
  assert.deepEqual(words, original);
});
