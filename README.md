# referrer-capture-astro

Lead attribution capture for Astro sites. Records where a visitor came from, keeps
it through their session, and attaches it to the contact form submission so the
notification email says which channel produced the lead.

**Status: planning. No code yet.** The design is settled and written up in
[`docs/PLAN.md`](docs/PLAN.md). The API sketched below is the target, not something
you can install today.

## Why This Exists

GA4 already reports source and medium in aggregate. What it cannot do is tell you
that *this particular inquiry* arrived from a Google organic search that landed on
`/services/`. Analytics answers questions about traffic. This answers a question
about one person who filled out your form.

That per-lead join is the whole point, and it sets the boundary. Anything that
starts rebuilding analytics dashboards belongs somewhere else.

## What It Captures

| Channel | Recognized from |
|---|---|
| `paid-search` | `gclid`, `gbraid`, `wbraid`, `msclkid`, or a paid `utm_medium` |
| `organic-search` | Search engine referrer with no click ID |
| `paid-social` | Paid social `utm_medium`, or social referrer carrying a click ID |
| `organic-social` | Social platform referrer |
| `ai-referral` | ChatGPT, Perplexity, Claude, Gemini, Copilot |
| `email` | `utm_medium=email`, or a known mail client referrer |
| `referral` | Any other external site |
| `direct` | No referrer, no campaign tags, no click ID |

The AI referral channel is worth calling out. A growing share of qualified traffic
now arrives from assistants rather than search results, and lumping it into
`referral` hides the one trend most worth watching.

Alongside the channel it records campaign, landing page, referrer domain, and how
the classification was reached (`utm`, `click-id`, `referrer`, or `direct`).

## How It Works

Three pieces, deliberately separated so the fragile part cannot break the
important part.

1. **Capture** runs on the landing page. It reads URL parameters and
   `document.referrer`, then writes one versioned record to `localStorage`.
2. **Persistence** carries that record across internal navigation. A direct visit
   never overwrites a known source, so someone who arrives from an ad, leaves, and
   returns via a bookmark keeps the ad.
3. **Normalization** happens once, on the server, when the form is submitted. Raw
   values go over the wire, canonical values come out.

Attribution is additive. If storage is blocked, the script throws, or the payload
arrives malformed, the submission proceeds with the source recorded as `unknown`.
A lead is worth more than knowing where it came from.

### Attribution Model

First touch and last non-direct touch are both stored. Last non-direct touch is
what gets reported, because it credits the most recent meaningful channel without
letting a bookmarked return visit erase it.

Both signals follow the same rule. Mixing models across signals produces answers
that depend on which touch happened to carry a UTM tag, which is how attribution
data quietly stops meaning anything.

## Install

```bash
npm install github:garrettatx/referrer-capture-astro#v1.0.0
```

Pinning to a tag is intentional. Improvements land here first, and each consuming
site moves its own pin when it is ready to take them.

## Usage

Add capture to your layout:

```astro
---
// src/layouts/BaseLayout.astro
---
<script>
  import { capture } from 'referrer-capture-astro/client';
  capture();
</script>
```

Attach it to a submission. For a form that posts JSON:

```js
import { getAttribution } from 'referrer-capture-astro/client';

await fetch('/api/contact/', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name, email, attribution: getAttribution() }),
});
```

For a form that posts natively, mount hidden inputs instead:

```js
import { mountHiddenFields } from 'referrer-capture-astro/client';
mountHiddenFields(document.querySelector('#contact-form'));
```

Normalize on the server:

```js
import { parseAttribution } from 'referrer-capture-astro/server';

const attribution = parseAttribution(body.attribution);
// { source: 'google', medium: 'organic', channel: 'organic-search', ... }
```

`parseAttribution` validates, caps length, sanitizes, and returns a safe fallback
rather than throwing. Calling code does not need a try/catch to stay upright.

## Compatibility

The core carries no imports from Astro, Cloudflare, or the DOM, which is what keeps
it portable and testable.

| Setup | Supported |
|---|---|
| Static Astro (no adapter) | Yes |
| Cloudflare Pages Functions | Yes, via the Pages Function adapter |
| Astro Actions (SSR or hybrid) | Yes, via the Actions adapter |
| View transitions (`ClientRouter`) | Yes, re-run `capture()` on `astro:page-load` |

Astro Actions are supported but never required. Static sites are the primary
target, and Pride and Prairie is the reference implementation.

## Out of Scope

Submission storage, multi-touch attribution, paid media reporting, and consent UI
are all outside this package. A `shouldCapture()` hook is provided for sites that
need to gate capture behind their own consent management.

## Development

```bash
npm install
npm test        # unit tests for classification and normalization
```

Classification and normalization are pure functions and carry the logic worth
testing. Start there.

## Documentation

- [`docs/PLAN.md`](docs/PLAN.md) covers the full design, the attribution model, the
  QA matrix, and the reasoning behind the decisions above.

## License

MIT. See [LICENSE](LICENSE).
