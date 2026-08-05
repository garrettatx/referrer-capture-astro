import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { applyTouch } from '../dist/core/record.js';
import { attributionForNotification, isBodyTooLarge } from '../dist/adapters/index.js';

const SITE = 'prideandprairie.com';
const T = (n) => new Date(Date.UTC(2026, 7, n, 12)).toISOString();

/** Walk a visitor through pages, then submit. Mirrors what really happens. */
function journey(steps) {
  let rec = null;
  for (const s of steps) {
    rec = applyTouch(rec, {
      host: SITE,
      path: s.path ?? '/',
      query: s.query ?? '',
      referrer: s.referrer ?? '',
      now: s.at ?? T(1),
    });
  }
  // The client sends JSON over the wire; the server parses it back.
  return attributionForNotification({ attribution: JSON.parse(JSON.stringify(rec)) });
}

describe('QA matrix, browser through to email', () => {
  const cases = [
    ['organic search', [{ referrer: 'https://www.google.com/', path: '/services/' }], 'google', 'organic', 'organic-search'],
    ['paid search, gclid', [{ query: '?gclid=EAIaIQ' }], 'google', 'cpc', 'paid-search'],
    ['paid search, msclkid', [{ query: '?msclkid=abc' }], 'bing', 'cpc', 'paid-search'],
    ['tagged email campaign', [{ query: '?utm_source=newsletter&utm_medium=email&utm_campaign=Spring%20Remodel' }], 'newsletter', 'email', 'email'],
    ['social referral', [{ referrer: 'https://www.facebook.com/' }], 'facebook', 'organic-social', 'organic-social'],
    ['AI assistant referral', [{ referrer: 'https://www.perplexity.ai/' }], 'perplexity', 'ai-referral', 'ai-referral'],
    ['plain referral', [{ referrer: 'https://news.example.org/x' }], 'news.example.org', 'referral', 'referral'],
    ['direct, no referrer', [{}], 'direct', 'none', 'direct'],
  ];

  for (const [name, steps, source, medium, channel] of cases) {
    test(name, () => {
      const { attribution } = journey(steps);
      assert.equal(attribution.source, source);
      assert.equal(attribution.medium, medium);
      assert.equal(attribution.channel, channel);
    });
  }

  test('paid click, browses, returns direct days later', () => {
    const { attribution } = journey([
      { query: '?gclid=abc', at: T(1) },
      { referrer: `https://${SITE}/services/`, path: '/work/', at: T(1) },
      { at: T(6), path: '/contact/' },
    ]);
    assert.equal(attribution.channel, 'paid-search', 'the ad must survive a direct return');
  });

  test('organic first, paid click later', () => {
    const { attribution } = journey([
      { referrer: 'https://www.google.com/', at: T(1) },
      { query: '?gclid=abc', at: T(9) },
    ]);
    assert.equal(attribution.medium, 'cpc');
    assert.equal(attribution.first_touch_source, 'google');
  });

  test('English to Spanish route switch does not reset attribution', () => {
    const { attribution } = journey([
      { referrer: 'https://www.google.com/', path: '/' },
      { referrer: `https://${SITE}/`, path: '/es/' },
      { referrer: `https://${SITE}/es/`, path: '/es/contact/' },
    ]);
    assert.equal(attribution.source, 'google');
    assert.equal(attribution.landing_page, '/', 'the original landing page is kept');
  });

  test('submitted from a page other than the landing page', () => {
    const { attribution } = journey([
      { referrer: 'https://www.bing.com/', path: '/services/' },
      { referrer: `https://${SITE}/services/`, path: '/contact/' },
    ]);
    assert.equal(attribution.landing_page, '/services/');
  });
});

describe('failure paths, which matter most', () => {
  test('no attribution at all still produces a usable notification', () => {
    const { attribution, text } = attributionForNotification({});
    assert.equal(attribution.channel, 'direct');
    assert.match(text, /none captured/);
  });

  test('a corrupted payload does not throw', () => {
    for (const bad of ['{{{', '[]', 'null', '"string"', '{"v":1}']) {
      assert.doesNotThrow(() => attributionForNotification({ attribution: bad }));
    }
  });

  test('an oversized attribution field is dropped, submission unaffected', () => {
    const { attribution } = attributionForNotification({ attribution: 'x'.repeat(5000) });
    assert.equal(attribution.capture_method, 'unknown');
  });

  test('body size guard reads content-length without reading the body', () => {
    assert.equal(isBodyTooLarge('20000'), true);
    assert.equal(isBodyTooLarge('500'), false);
    assert.equal(isBodyTooLarge(null), false);
    assert.equal(isBodyTooLarge('not a number'), false);
  });

  test('a hostile campaign value cannot reach an email header or markup', () => {
    const rec = applyTouch(null, {
      host: SITE, path: '/', now: T(1), referrer: '',
      query: '?utm_source=x&utm_medium=cpc&utm_campaign=' + encodeURIComponent('a\r\nBcc: evil@test.com<img src=x>'),
    });
    const { text, html } = attributionForNotification({ attribution: rec });
    assert.ok(!text.includes('\r'), 'no carriage returns');
    assert.ok(!text.includes('Bcc:'), 'no header injection');
    assert.ok(!html.includes('<img'), 'no markup injection');
  });
});
