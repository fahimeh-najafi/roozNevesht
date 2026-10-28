import test from 'node:test';
import assert from 'node:assert/strict';
import { dateKey, parseDate, monthDays, readNotes } from './calendar.js';

test('calendar is Monday-first with 42 consecutive local dates', () => {
  const days = monthDays(2026, 9);
  assert.equal(days.length, 42);
  assert.equal(days[0].getDay(), 1);
  assert.equal(dateKey(days[0]), '2026-09-28');
  assert.equal(dateKey(days[41]), '2026-11-08');
  assert.equal(new Set(days.map(dateKey)).size, 42);
});

test('calendar handles leap years and year boundaries', () => {
  assert.ok(monthDays(2028, 1).some((day) => dateKey(day) === '2028-02-29'));
  assert.equal(dateKey(monthDays(2027, 0)[0]), '2026-12-28');
  assert.equal(dateKey(new Date(2026, 12, 1, 12)), '2027-01-01');
});

test('date keys round-trip without UTC date shifts', () => {
  for (const key of ['2026-01-01', '2026-03-08', '2026-11-01', '2028-02-29']) {
    assert.equal(dateKey(parseDate(key)), key);
  }
});

test('stored notes survive serialization and invalid entries are excluded', () => {
  const note = { title: 'A small win', body: 'Walked in the park.\nA lovely afternoon.' };
  assert.deepEqual(readNotes(JSON.stringify({ '2026-10-27': note, bad: {}, '2026-10-28': null })), { '2026-10-27': note });
  assert.deepEqual(readNotes(null), {});
  assert.throws(() => readNotes('{broken'));
  assert.throws(() => readNotes('[]'));
});