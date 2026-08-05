import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseAttribution, attributionFromBody, MAX_PAYLOAD_BYTES } from '../dist/server/index.js';
import { formatForEmail, formatForEmailHtml, isUnattributed } from '../dist/server/index.js';
import { applyTouch } from '../dist/core/record.js';

const base = { host: 'example.com', path: '/services/', query: '', referrer: '', now: '2026-08-05T12:00:00.000Z' };
const record = applyTouch(null, { ...base, referrer: 'https://www.google.com/' });

describe('parseAttribution never throws', () => {
  const hostile = [
    null, undefined, '', 0, false, [], {}, 'not json', '{"v":1}',
    '{"v":999,"first":{},"last":{}}',
    { v: 1 }, { __proto__: { polluted: true } },
    '{"v":1,"first":{"ts":1},"last":{},"ids":{},"n":0}',
  ];
  for (const input of hostile) {
    test(`survives ${JSON.stringify(input)?.slice(0, 40)}`, () => {
      assert.doesNotThrow(() => parseAttribution(input));
      const out = parseAttribution(input);
      assert.equal(typeof out.source, 'string');
      assert.equal(typeof out.channel, 'string');
    });
  }

  test('an oversized payload is dropped, not parsed', () => {
    const big = JSON.stringify({ ...record, pad: 'x'.repeat(MAX_PAYLOAD_BYTES) });
    assert.ok(big.length > MAX_PAYLOAD_BYTES);
    assert.equal(parseAttribution(big).capture_method, 'unknown');
  });

  test('a valid record round-trips through JSON', () => {
    const out = parseAttribution(JSON.stringify(record));
    assert.equal(out.source, 'google');
    assert.equal(out.channel, 'organic-search');
  });

  test('an already-parsed object works the same as its JSON string', () => {
    assert.deepEqual(parseAttribution(record), parseAttribution(JSON.stringify(record)));
  });

  test('attributionFromBody reads the field and tolerates a missing body', () => {
    assert.equal(attributionFromBody({ attribution: record }).source, 'google');
    assert.equal(attributionFromBody(null).capture_method, 'unknown');
    assert.equal(attributionFromBody({}).capture_method, 'unknown');
  });
});

describe('email formatting', () => {
  test('renders the channel a human can read', () => {
    const out = formatForEmail(parseAttribution(record));
    assert.match(out, /Source:\s+google \/ organic\s+\(organic-search\)/);
    assert.match(out, /Landing page:\s+\/services\//);
  });

  test('says so explicitly when nothing was captured', () => {
    const out = formatForEmail(parseAttribution(null));
    assert.match(out, /none captured/);
    assert.ok(isUnattributed(parseAttribution(null)));
  });

  test('omits empty rows rather than printing unknown repeatedly', () => {
    const out = formatForEmail(parseAttribution(record));
    assert.ok(!out.includes('Campaign'), 'no campaign means no campaign row');
    assert.ok(!/unknown/i.test(out));
  });

  test('shows the raw referrer only when the channel does not name it', () => {
    const referral = applyTouch(null, { ...base, referrer: 'https://news.example.org/a' });
    assert.match(formatForEmail(parseAttribution(referral)), /Referrer:\s+news\.example\.org/);
    assert.ok(!formatForEmail(parseAttribution(record)).includes('Referrer:'));
  });

  test('html output escapes its values', () => {
    const nasty = applyTouch(null, { ...base, query: '?utm_source=%3Cimg%20src%3Dx%3E&utm_medium=cpc' });
    const html = formatForEmailHtml(parseAttribution(nasty));
    assert.ok(!html.includes('<img'), 'markup must not survive into the email');
  });

  test('first touch is shown only when it differs from the reported source', () => {
    let r = applyTouch(null, { ...base, referrer: 'https://www.google.com/' });
    r = applyTouch(r, { ...base, query: '?utm_source=newsletter&utm_medium=email', now: '2026-08-06T12:00:00.000Z' });
    assert.match(formatForEmail(parseAttribution(r)), /First touch:\s+google/);
    assert.ok(!formatForEmail(parseAttribution(record)).includes('First touch'));
  });
});
