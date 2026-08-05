# API Reference

Three entry points. Import only what a given layer needs.

| Import | Runs in | Use for |
|---|---|---|
| `referrer-capture-astro/client` | Browser | Recording the visit, reading the record |
| `referrer-capture-astro/server` | Server | Validating, normalizing, formatting |
| `referrer-capture-astro/adapters` | Server | Cloudflare Pages Function convenience |
| `referrer-capture-astro/core` | Anywhere | Pure classification, no I/O |

---

## Client

### `capture(options?)`

Records how the visitor arrived. Call on every page load, from your base layout.
Never throws. Returns the stored record, or `null` if capture was skipped.

Safe to call repeatedly. Internal navigation is not treated as an arrival, so browsing
the site never overwrites the original source.

```js
import { capture } from 'referrer-capture-astro/client';
capture();
```

**Options**

| Option | Default | Purpose |
|---|---|---|
| `lookbackDays` | `90` | How long the browser keeps the record |
| `shouldCapture` | `() => true` | Return `false` to skip. Wire a consent platform here |
| `storageKey` | `'rc_attr'` | Override for running more than one instance |

### `getAttribution(options?)`

The stored record, or `null` when there is none or it has expired. Never throws.

```js
import { getAttribution } from 'referrer-capture-astro/client';
body: JSON.stringify({ name, email, attribution: getAttribution() })
```

### `mountHiddenFields(form, options?)`

Adds the record to a form as a hidden input, for forms that post natively instead of
building a JSON body. Re-mounting is safe.

### `autoMount(form, options?)`

Mounts now and refreshes on submit, so a form left open overnight still carries a
current record.

### `clearAttribution(options?)`

Removes the stored record. For consent withdrawal and debugging.

### `storageKind()`

Returns `'local'`, `'session'`, `'memory'`, or `'unavailable'`. Debugging aid for
working out why a visitor recorded as `unknown`.

---

## Server

### `parseAttribution(input)`

Validates, caps, sanitizes, and normalizes. Accepts a JSON string or an already-parsed
object. **Never throws.** A missing, malformed, oversized, or hostile payload returns
the unattributed record, so calling code needs no `try/catch`.

```js
import { parseAttribution } from 'referrer-capture-astro/server';
const attribution = parseAttribution(body.attribution);
```

Returns a `NormalizedAttribution`:

| Field | Example | Notes |
|---|---|---|
| `source` | `google` | Lowercase, hyphenated, alias-collapsed |
| `medium` | `cpc` | Same |
| `channel` | `paid-search` | See the channel table in the README |
| `campaign` | `spring-remodel` | `null` when untagged |
| `landing_page` | `/services/` | The entry page, not the submitting page |
| `referrer_domain` | `news.example.org` | `null` when there was no referrer |
| `capture_method` | `utm` | `utm`, `click-id`, `referrer`, `direct`, `unknown` |
| `first_touch_source` | `google` | The first source ever seen |
| `first_touch_at` | `2026-08-01T14:22:10Z` | ISO timestamp |
| `click_ids` | `{ gclid: '...' }` | Ad click identifiers seen |

### `attributionFromBody(body, field?)`

Reads the attribution field out of a submitted body. Tolerates a missing body.

### `formatForEmail(attribution, options?)`

Plain text block for a notification email. Prints one explicit line when nothing was
captured, so an empty section is never ambiguous.

### `formatForEmailHtml(attribution, options?)`

The HTML equivalent. Escapes every value.

### `isUnattributed(attribution)`

True when there is nothing worth printing.

**Format options**

| Option | Default |
|---|---|
| `title` | `'Where this lead came from'` |
| `emptyLabel` | `'Attribution: none captured (direct visit, or storage blocked)'` |

---

## Adapters

### `attributionForNotification(body, options?)`

Everything a Cloudflare Pages Function needs in one call. Returns
`{ attribution, text, html }`. Never throws.

```js
import { attributionForNotification } from 'referrer-capture-astro/adapters';
const { attribution, text, html } = attributionForNotification(body);
```

### `isBodyTooLarge(contentLength, max?)`

Pass `request.headers.get('content-length')`. Rejects before the body is read, so an
oversized payload costs nothing. Defaults to 10 KB.

---

## Core

Pure functions with no Astro, platform, or DOM imports. Useful for testing, custom
adapters, or classifying outside a request.

| Function | Purpose |
|---|---|
| `classify(input)` | One page load to a `Touch`, or `null` for internal navigation |
| `classifyReferrer(url)` | Referrer to `{ source, medium }` |
| `classifyHost(host)` | Hostname to a known platform, or `null` |
| `toChannel(source, medium)` | Source and medium to a channel |
| `applyTouch(record, input)` | Fold a page load into the stored record |
| `normalize(record)` | Stored record to the canonical output |
| `isExpired(record, now, days)` | Lookback check |
| `isValidRecord(value)` | Schema guard |
| `slug(value)` | The canonicalizer used on every value |

---

## Extending the Platform Maps

Domain and alias maps are plain data in `src/config/`. Adding a search engine, social
platform, AI assistant, or webmail host is a one-line change and a good first
contribution.

```
src/config/search.ts   Search engines
src/config/social.ts   Social platforms
src/config/ai.ts       AI assistants
src/config/email.ts    Webmail clients
src/config/aliases.ts  Source and medium spellings, ad click identifiers
```

Order of matching is email, then AI, then search, then social. Webmail and AI
assistants live on search engine domains, so the specific maps have to run first.
