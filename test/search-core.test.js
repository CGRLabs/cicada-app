import test from 'node:test';
import assert from 'node:assert/strict';
import { normalize, scoreMatch, scoreItem, filterPool } from '../src/gui/renderer/search-core.js';

test('normalize lowercases, trims and null-safes text', () => {
  assert.equal(normalize('  Foo BAR '), 'foo bar');
  assert.equal(normalize(null), '');
  assert.equal(normalize(undefined), '');
  assert.equal(normalize(42), '42');
});

test('scoreMatch ranks prefix > word-boundary > substring > miss', () => {
  assert.equal(scoreMatch('Chrome', 'chr'), 3, 'prefix hit');
  assert.equal(scoreMatch('Google Chrome', 'chr'), 2, 'word-boundary hit');
  assert.equal(scoreMatch('MicroChrome', 'chr'), 1, 'plain substring');
  assert.equal(scoreMatch('Firefox', 'chr'), 0, 'no match');
});

test('scoreMatch is case-insensitive and treats empty query as match-all', () => {
  assert.equal(scoreMatch('CHROME', 'chrome'), 3);
  assert.equal(scoreMatch('anything', ''), 0);
  assert.equal(scoreMatch('', 'x'), 0);
});

test('scoreItem takes the best score across fields', () => {
  const app = { displayName: 'Firefox', publisher: 'Mozilla Foundation' };
  assert.equal(scoreItem(app, ['displayName', 'publisher'], 'found'), 2, 'word-boundary on publisher');
  assert.equal(scoreItem(app, ['displayName', 'publisher'], 'fire'), 3, 'prefix on name wins');
  assert.equal(scoreItem(app, ['displayName', 'publisher'], 'zzz'), 0);
});

test('filterPool ranks matches and caps the result at the limit', () => {
  const apps = [
    { name: 'Chrome' },
    { name: 'Chrome Canary' },
    { name: 'Chromecast' },
    { name: 'Firefox' },
    { name: 'MyChrome Clone' }
  ];
  const hits = filterPool(apps, 'chrome', ['name'], 3);
  assert.equal(hits.length, 3, 'limit respected');
  assert.equal(hits[0].name, 'Chrome', 'prefix hit ranks first');
  assert.ok(hits.slice(1).map((a) => a.name).includes('Chrome Canary'));
  assert.ok(!hits.map((a) => a.name).includes('Firefox'));
});

test('filterPool with an empty query returns the head of the pool in order', () => {
  const apps = [{ name: 'A' }, { name: 'B' }, { name: 'C' }];
  assert.deepEqual(filterPool(apps, '', ['name'], 2), [{ name: 'A' }, { name: 'B' }]);
});

test('filterPool is stable for equal scores (original order kept)', () => {
  const apps = [{ name: 'alpha one' }, { name: 'alpha two' }, { name: 'alpha three' }];
  const hits = filterPool(apps, 'alpha', ['name'], 10);
  assert.deepEqual(hits.map((a) => a.name), ['alpha one', 'alpha two', 'alpha three']);
});

test('filterPool tolerates non-array input', () => {
  assert.deepEqual(filterPool(null, 'x', ['name']), []);
  assert.deepEqual(filterPool(undefined, '', ['name']), []);
});
