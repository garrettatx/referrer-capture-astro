import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { applyTouch, isExpired, isValidRecord, SCHEMA_VERSION } from '../dist/core/record.js';
import { normalize } from '../dist/core/normalize.js';

const base = { host: 'example.com', path: '/', query: '', referrer: '' };
const day = (n) => new Date(Date.UTC(2026, 7, n, 12)).toISOString();
const visit = (rec, o, when) => applyTouch(rec, { ...base, ...o, now: when });

describe('touch merging', () => {
  test('first touch is written once and never replaced', () => {
    let r = visit(null, { referrer: 'https://www.google.com/' }, day(1));
    assert.equal(r.first.src, 'google');
    r = visit(r, { query: '?utm_source=newsletter&utm_medium=email' }, day(2));
    assert.equal(r.first.src, 'google', 'first touch must not move');
    assert.equal(r.last.src, 'newsletter');
  });

  test('a direct return never overwrites a known source', () => {
    let r = visit(null, { query: '?gclid=abc' }, day(1));
    assert.equal(r.last.src, 'google');
    assert.equal(r.last.med, 'cpc');
    r = visit(r, {}, day(3));
    assert.equal(r.last.src, 'google', 'direct visit must not erase the ad');
    assert.equal(r.last.med, 'cpc');
  });

  test('a later paid click wins, first touch keeps organic', () => {
    let r = visit(null, { referrer: 'https://www.google.com/' }, day(1));
    r = visit(r, { query: '?gclid=abc' }, day(4));
    assert.equal(r.last.med, 'cpc');
    assert.equal(r.first.med, 'organic');
  });

  test('internal navigation changes nothing at all', () => {
    const r = visit(null, { referrer: 'https://www.google.com/' }, day(1));
    const after = visit(r, { referrer: 'https://example.com/services/', path: '/contact/' }, day(1));
    assert.deepEqual(after, r, 'browsing must be inert');
    assert.equal(after.n, 1, 'internal navigation is not a touch');
  });

  test('click ids accumulate across visits', () => {
    let r = visit(null, { query: '?gclid=one' }, day(1));
    r = visit(r, { query: '?msclkid=two' }, day(2));
    assert.equal(r.ids.gclid, 'one');
    assert.equal(r.ids.msclkid, 'two');
  });

  test('touch count increments on real arrivals', () => {
    let r = visit(null, { referrer: 'https://www.google.com/' }, day(1));
    r = visit(r, { referrer: 'https://www.bing.com/' }, day(2));
    assert.equal(r.n, 2);
  });
});

describe('expiry', () => {
  test('a record inside the window is kept', () => {
    const r = visit(null, { referrer: 'https://www.google.com/' }, day(1));
    assert.equal(isExpired(r, day(20), 90), false);
  });
  test('a record past the window is expired', () => {
    const r = visit(null, { referrer: 'https://www.google.com/' }, '2026-01-01T00:00:00.000Z');
    assert.equal(isExpired(r, '2026-08-05T00:00:00.000Z', 90), true);
  });
  test('an unparseable timestamp counts as expired', () => {
    assert.equal(isExpired({ last: { ts: 'nonsense' } }, day(1), 90), true);
  });
});

describe('record validation', () => {
  test('rejects junk', () => {
    for (const bad of [null, undefined, 42, 'string', {}, [], { v: 99 }]) {
      assert.equal(isValidRecord(bad), false, `${JSON.stringify(bad)} should be rejected`);
    }
  });
  test('rejects a record from a future schema version', () => {
    const r = visit(null, {}, day(1));
    assert.equal(isValidRecord({ ...r, v: SCHEMA_VERSION + 1 }), false);
  });
  test('accepts what applyTouch produces', () => {
    assert.equal(isValidRecord(visit(null, { referrer: 'https://www.google.com/' }, day(1))), true);
  });
});

describe('normalize', () => {
  test('reports the last non-direct touch', () => {
    let r = visit(null, { referrer: 'https://www.google.com/' }, day(1));
    r = visit(r, { query: '?utm_source=newsletter&utm_medium=email&utm_campaign=Spring_Remodel' }, day(2));
    const n = normalize(r);
    assert.equal(n.source, 'newsletter');
    assert.equal(n.medium, 'email');
    assert.equal(n.channel, 'email');
    assert.equal(n.campaign, 'spring-remodel');
    assert.equal(n.first_touch_source, 'google');
  });

  test('a null record is unattributed rather than an error', () => {
    const n = normalize(null);
    assert.equal(n.source, 'direct');
    assert.equal(n.channel, 'direct');
    assert.equal(n.capture_method, 'unknown');
  });

  test('referrer domain is extracted for referral traffic', () => {
    const r = visit(null, { referrer: 'https://news.example.org/article' }, day(1));
    assert.equal(normalize(r).referrer_domain, 'news.example.org');
  });
});
