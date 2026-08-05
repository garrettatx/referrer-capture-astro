import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { classify, classifyReferrer, slug, toChannel, isInternal, referrerHost } from '../dist/core/classify.js';

const NOW = '2026-08-05T12:00:00.000Z';
const base = { host: 'example.com', path: '/', now: NOW, query: '', referrer: '' };
const at = (o) => classify({ ...base, ...o });

describe('slug', () => {
  test('collapses casing, spaces, and underscores', () => {
    assert.equal(slug('  Paid Social  '), 'paid-social');
    assert.equal(slug('paid_social'), 'paid-social');
    assert.equal(slug('GOOGLE'), 'google');
  });
  test('strips characters that would break a report or a header', () => {
    assert.equal(slug('goo<script>gle'), 'gooscriptgle');
    assert.equal(slug('a\r\nb'), 'a-b');
  });
  test('survives non-strings', () => {
    assert.equal(slug(null), '');
    assert.equal(slug(42), '');
    assert.equal(slug(undefined), '');
  });
});

describe('referrer classification', () => {
  const cases = [
    ['https://www.google.com/', 'google', 'organic'],
    ['https://www.bing.com/search?q=x', 'bing', 'organic'],
    ['https://duckduckgo.com/', 'duckduckgo', 'organic'],
    ['https://www.facebook.com/', 'facebook', 'organic-social'],
    ['https://t.co/abc', 'twitter', 'organic-social'],
    ['https://chatgpt.com/', 'chatgpt', 'ai-referral'],
    ['https://www.perplexity.ai/', 'perplexity', 'ai-referral'],
    ['https://claude.ai/', 'claude', 'ai-referral'],
    ['https://mail.google.com/', 'gmail', 'email'],
    ['https://some-blog.example.org/post', 'some-blog.example.org', 'referral'],
  ];
  for (const [ref, source, medium] of cases) {
    test(`${ref} -> ${source} / ${medium}`, () => {
      assert.deepEqual(classifyReferrer(ref), { source, medium });
    });
  }

  test('AI assistants are separated from generic referral', () => {
    assert.equal(classifyReferrer('https://chatgpt.com/').medium, 'ai-referral');
    assert.notEqual(classifyReferrer('https://chatgpt.com/').medium, 'referral');
  });

  test('malformed and origin-only referrers do not throw', () => {
    assert.equal(referrerHost('not a url'), '');
    assert.equal(referrerHost('android-app://com.google.android.gm'), 'com.google.android.gm');
    assert.deepEqual(classifyReferrer('%%%'), { source: 'direct', medium: 'none' });
  });
});

describe('precedence', () => {
  test('campaign tags beat referrer', () => {
    const t = at({ query: '?utm_source=newsletter&utm_medium=email', referrer: 'https://www.google.com/' });
    assert.equal(t.src, 'newsletter');
    assert.equal(t.med, 'email');
    assert.equal(t.m, 'utm');
  });

  test('click id is used when tags are absent', () => {
    const t = at({ query: '?gclid=abc123' });
    assert.equal(t.src, 'google');
    assert.equal(t.med, 'cpc');
    assert.equal(t.m, 'click-id');
  });

  test('msclkid maps to bing paid', () => {
    const t = at({ query: '?msclkid=xyz' });
    assert.equal(t.src, 'bing');
    assert.equal(t.med, 'cpc');
  });

  test('fbclid is social but not paid, since Facebook adds it to organic links too', () => {
    const t = at({ query: '?fbclid=abc' });
    assert.equal(t.src, 'facebook');
    assert.equal(t.med, 'organic-social');
    assert.notEqual(t.med, 'paid-social');
  });

  test('referrer is used when nothing else is present', () => {
    const t = at({ referrer: 'https://www.google.com/' });
    assert.equal(t.m, 'referrer');
  });

  test('no signal at all is direct', () => {
    const t = at({});
    assert.equal(t.src, 'direct');
    assert.equal(t.med, 'none');
    assert.equal(t.m, 'direct');
  });
});

describe('internal navigation', () => {
  test('same host is not an arrival', () => {
    assert.equal(at({ referrer: 'https://example.com/services/', path: '/contact/' }), null);
  });
  test('www and apex are the same site', () => {
    assert.equal(at({ referrer: 'https://www.example.com/x', host: 'example.com' }), null);
    assert.equal(at({ referrer: 'https://example.com/x', host: 'www.example.com' }), null);
  });
  test('localized routes are internal', () => {
    assert.equal(at({ referrer: 'https://example.com/contact/', path: '/es/contact/' }), null);
  });
  test('a tagged link is an arrival even from an internal referrer', () => {
    const t = at({ referrer: 'https://example.com/x', query: '?utm_source=newsletter&utm_medium=email' });
    assert.equal(t.src, 'newsletter');
  });
  test('isInternal handles subdomains', () => {
    assert.equal(isInternal('https://blog.example.com/', 'example.com'), true);
    assert.equal(isInternal('https://notexample.com/', 'example.com'), false);
  });
});

describe('alias collapsing', () => {
  test('paid search spellings collapse to one medium', () => {
    for (const m of ['cpc', 'ppc', 'PPC', 'paid_search', 'Paid Search', 'adwords']) {
      const t = at({ query: `?utm_source=google&utm_medium=${encodeURIComponent(m)}` });
      assert.equal(t.med, 'cpc', `${m} should map to cpc`);
    }
  });
  test('source spellings collapse', () => {
    assert.equal(at({ query: '?utm_source=FB&utm_medium=social' }).src, 'facebook');
    assert.equal(at({ query: '?utm_source=X&utm_medium=social' }).src, 'twitter');
  });
});

describe('channels', () => {
  const cases = [
    ['google', 'cpc', 'paid-search'],
    ['google', 'organic', 'organic-search'],
    ['facebook', 'paid-social', 'paid-social'],
    ['facebook', 'organic-social', 'organic-social'],
    ['chatgpt', 'ai-referral', 'ai-referral'],
    ['newsletter', 'email', 'email'],
    ['example.org', 'referral', 'referral'],
    ['direct', 'none', 'direct'],
    ['weird', 'sponsorship', 'other'],
  ];
  for (const [s, m, channel] of cases) {
    test(`${s} / ${m} -> ${channel}`, () => assert.equal(toChannel(s, m), channel));
  }
});

describe('hostile input', () => {
  test('oversized values are capped', () => {
    const t = at({ query: `?utm_source=${'a'.repeat(5000)}&utm_medium=cpc` });
    assert.ok(t.src.length <= 200);
  });
  test('header injection characters do not survive', () => {
    const t = at({ query: '?utm_source=' + encodeURIComponent('bad\r\nBcc: someone@evil.test') });
    assert.ok(!t.src.includes('\n'));
    assert.ok(!t.src.includes('\r'));
    assert.ok(!t.src.includes('@'));
  });
  test('a malformed query string does not throw', () => {
    assert.doesNotThrow(() => at({ query: '?%%%&&&===' }));
  });
});

describe('map precedence', () => {
  test('webmail on a search engine domain is email, not organic search', () => {
    assert.deepEqual(classifyReferrer('https://mail.google.com/'), { source: 'gmail', medium: 'email' });
    assert.deepEqual(classifyReferrer('https://mail.yahoo.com/'), { source: 'yahoo-mail', medium: 'email' });
  });
  test('an AI assistant on a search engine domain is ai-referral', () => {
    assert.deepEqual(classifyReferrer('https://gemini.google.com/'), { source: 'gemini', medium: 'ai-referral' });
  });
  test('plain search still resolves to organic', () => {
    assert.deepEqual(classifyReferrer('https://www.google.com/search?q=x'), { source: 'google', medium: 'organic' });
  });
});
