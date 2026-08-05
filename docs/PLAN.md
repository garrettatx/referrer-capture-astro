# Design and Build Plan

The design for `referrer-capture-astro`, the reasoning behind each decision, and the
order it gets built in.

Status: built and released as v1.0.1. This document is the design record.

---

## 1. What This Is For

One job. Tell the person reading a lead notification where that lead came from.

Analytics platforms report source and medium in aggregate. They cannot tell you that
this particular inquiry arrived from an organic search that landed on `/services/`.
Joining attribution to a single submission is the value here, and it sets the
boundary for everything below.

That boundary needs defending. Attribution systems drift toward rebuilding analytics:
confidence scores, storage-state fields, parallel raw and normalized values on the
wire, schema versioning at every layer. Each addition is defensible on its own.
Together they turn a contact form into a tracking project, and the contact form is
the part that earns money.

---

## 2. Design Decisions

### 2.1 The Core Is Transport-Agnostic

Astro sites submit forms in several ways. Astro Actions on SSR and hybrid builds, a
platform function on static builds, a third-party endpoint, a native form post. A
package that assumes one of these locks out the rest.

Static builds are the common case and have no server runtime, so Actions are
unavailable to them until you add an adapter and convert the site to SSR. That is a
large change to make for attribution alone.

**Decision.** Normalization is a pure function with no Astro, platform, or DOM
imports. Adapters for Astro Actions and Cloudflare Pages Functions ship alongside it.
Neither is required to use the core.

### 2.2 Capture Runs in the Browser

A server-side referrer parser sounds like useful redundancy. On a static site it is
close to useless.

Pages are HTML served from a CDN edge cache. The server only runs when the form is
submitted, and by then the `Referer` header points at the site's own contact page.
The original external referrer is gone. Recovering it server-side means running
middleware on every HTML request, which costs full-page caching.

It also guards a case that mostly does not exist. A form submitted by `fetch()`
already requires JavaScript, so attribution requiring JavaScript adds no new failure
mode. Sites using native form posts are the exception, and they read the record from
hidden inputs.

**Decision.** Capture client-side. The server validates, sanitizes, and normalizes,
which is where the work that matters happens.

### 2.3 localStorage, Not Cookies

Cookies win when the server needs to read a value during a request. Nothing here
does. Meanwhile the browser attaches every cookie to every request it makes,
including HTML, CSS, fonts, and images, adding bytes to each one for no return.

**Decision.** One versioned `localStorage` record, falling back to `sessionStorage`
if `localStorage` throws, which happens in Safari private mode and partitioned
iframes. If both fail, capture in memory for the current page and continue.

### 2.4 The Client Sends Raw Values, the Server Normalizes Once

Sending raw and normalized values together from the browser puts the mapping logic in
two places. Those copies drift, and when they disagree nothing tells you which one
produced a given record.

**Decision.** One compact JSON object of raw values on the wire. Normalization runs
once, server-side. Sites posting natively can use `mountHiddenFields(form)`. Transport
is a per-site choice and sits outside the data contract.

A confidence score is excluded on purpose. Nobody acts on it. `capture_method`
(`utm`, `click-id`, `referrer`, `direct`) stays, because it answers the question a
reader has, which is why the record says what it says.

### 2.5 One Attribution Model, Applied to Every Signal

A common failure is running different models on different signals: campaign tags
treated as last touch, referrers treated as first touch. The answer then depends on
which touch happened to carry a tag. Someone arriving from an ad and returning
through search keeps the ad. Someone arriving through search and returning via an ad
also gets the ad. Same journey shape, two different answers, no way to explain
either one.

**Decision.** Store first touch and last non-direct touch. Apply the same rule to
campaign tags and referrers. Report last non-direct touch. Direct visits never
overwrite a known source.

### 2.6 AI Assistants Get Their Own Channel

A growing share of qualified traffic arrives from AI assistants rather than search
results. Filing it under generic `referral` hides the trend moving fastest.

**Decision.** `ai-referral` is a first-class channel.

### 2.7 Consent Is a Hook, Not a Feature

Consent requirements vary by jurisdiction and by site, and many sites already run a
platform that owns the decision.

**Decision.** Expose a `shouldCapture()` hook, default permissive, documented. Sites
needing a gate wire their consent platform into it. This package ships no consent UI
and assumes none exists.

### 2.8 No Payload Signing

A tampered attribution value produces a wrong word in an email. Signing the payload
costs real complexity and buys little against that. Sanitizing, length-capping, and
allow-listing before any value reaches a header or an email body covers the threat.

---

## 3. Scope

**In**

- Client capture of campaign parameters, ad click IDs, and referrer on landing.
- First-party persistence across a session, surviving internal navigation, including
  moves between localized versions of the same page.
- Server-side normalization to a stable source, medium, and channel taxonomy.
- A short attribution block in the notification email.

**Out**

- Submission storage. This package persists no form data.
- Multi-touch attribution, paid media reporting, dashboards.
- Consent UI.
- Duplicating an analytics platform.
- Endpoint concerns that belong to the host site: rate limiting, origin
  allow-listing, spam heuristics. These are properties of a submission endpoint. A
  consuming site may already have them, so this package neither assumes them nor
  ships its own.
- Anything that makes lead capture depend on attribution succeeding.

---

## 4. Attribution Model

| | Rule |
|---|---|
| Reported value | Last non-direct touch |
| Also stored | First touch |
| Precedence within a touch | Campaign parameters, then ad click ID, then referrer, then direct |
| Overwrite rule | A new non-direct touch updates `last`. Direct visits never overwrite. `first` is written once. |
| Internal navigation | Never a touch. A referrer matching the current host is ignored. |
| Lookback window | 90 days. How long the visitor's browser keeps its record before it expires. Matches the default acquisition lookback in common analytics platforms, so the email agrees with their reports. Configurable. |

Localized routes such as `/contact/` and `/es/contact/` count as internal navigation
and must not reset attribution.

The lookback window governs the visitor's own browser storage. This package stores no
submissions.

---

## 5. Data Contract

### Stored Record (localStorage, key `rc_attr`)

```jsonc
{
  "v": 1,
  "first": {
    "src": "google", "med": "organic", "cmp": null,
    "ref": "https://www.google.com/", "lp": "/services/", "ts": "2026-08-01T14:22:10Z"
  },
  "last": {           // last NON-DIRECT touch; may equal first
    "src": "google", "med": "cpc", "cmp": "brand-aug",
    "ref": "", "lp": "/", "ts": "2026-08-04T09:01:44Z"
  },
  "ids": { "gclid": "Cj0KC..." },
  "n": 3              // touch count, for debugging
}
```

### Wire Payload

One added key on the submission:

```jsonc
"attribution": { /* the record above, serialized, hard-capped at 2 KB */ }
```

Missing, malformed, oversized, or unparseable, the server drops it and processes the
submission normally.

The blob is untrusted input, so its 2 KB cap belongs inside a whole-body size cap on
the endpoint. Sites without one should add it during integration.

### Normalized Output (Server-Side)

`source` · `medium` · `channel` · `campaign` · `landing_page` · `referrer_domain` ·
`capture_method` · `first_touch_source` · `first_touch_at`

Lowercase, hyphen-separated, no spaces. Unknown resolves to `unknown`. No source
resolves to `direct` / `none`.

---

## 6. Channel Taxonomy

| Channel | Trigger |
|---|---|
| `paid-search` | `gclid`, `gbraid`, `wbraid`, `msclkid`, or `utm_medium` in {cpc, ppc, paid-search, paidsearch} |
| `organic-search` | Search engine referrer with no click ID, or `utm_medium=organic` |
| `paid-social` | `utm_medium` in {paid-social, paidsocial}, or a social referrer carrying a click ID |
| `organic-social` | Social platform referrer, or `utm_medium` in {social, organic-social} |
| `ai-referral` | AI assistant referrer |
| `email` | `utm_medium=email`, or a known mail client referrer |
| `referral` | Any other external referrer |
| `direct` | No referrer, no campaign parameters, no click ID |
| `other` | Tagged but unmappable |

Domain and alias maps live in `src/config/` as plain data, so a site can extend them
without touching core logic.

Click IDs captured: `gclid`, `gbraid`, `wbraid`, `msclkid`, `fbclid`, `ttclid`.

---

## 7. Distribution

Target sites depend on this repository rather than copying the code into their own. A
copy stops receiving improvements the moment it is made, which defeats the point of
having a canonical source.

Use a GitHub-hosted npm dependency, pinned to a tag:

```jsonc
// your target Astro site's package.json
"dependencies": {
  "referrer-capture-astro": "github:garrettatx/referrer-capture-astro#v1.0.0"
}
```

- No registry publishing required, and private consumers work.
- Improvements land here, then each site moves its pin when ready. Nothing changes
  under a site mid-deploy.
- Installs at build time on common hosts with no extra configuration.

Prebuilt ESM and type declarations ship in the repository, so consumers need no build
step.

Alternatives considered. Git submodules propagate but cause recurring CI and clone
problems. A copy plus a sync script drifts the first time someone patches a target
site directly. Registry publishing is reasonable later and unnecessary now.

---

## 8. Repository Layout

```
referrer-capture-astro/
├── src/
│   ├── core/
│   │   ├── normalize.ts        # pure: raw record → normalized output
│   │   ├── classify.ts         # referrer and campaign params → source, medium, channel
│   │   └── types.ts
│   ├── client/
│   │   ├── capture.ts          # landing capture and persistence
│   │   └── mount.ts            # getAttribution() and mountHiddenFields(form)
│   ├── server/
│   │   └── parse.ts            # validate, cap, sanitize, normalize
│   ├── adapters/
│   │   ├── pages-function.ts
│   │   └── astro-action.ts
│   └── config/
│       ├── search.ts  social.ts  ai.ts  aliases.ts
├── docs/
├── tests/
└── examples/
```

Core imports nothing from Astro, a hosting platform, or the DOM. That is what keeps
it testable and portable.

---

## 9. Integrating With a Static Astro Site

Four touch points.

1. **Layout.** One inline script calling `capture()` on load. No hydration, no island.
   On sites using view transitions, re-run it on `astro:page-load`.
2. **Form.** Add the attribution record to the submission payload, or mount hidden
   inputs for a native post.
3. **Endpoint.** Parse, normalize, append to the notification, wrapped so any failure
   is swallowed.
4. **package.json.** The pinned dependency.

One rule holds above the rest: attribution must never fail a submission. If
normalization throws, the lead sends with `unknown`. That gets an explicit test.

---

## 10. Email Output

Appended to the notification body:

```
--- Where this lead came from ---
Source:       google / organic  (organic-search)
Campaign:     brand-aug
Landing page: /services/
First touch:  google / organic on Aug 1
```

Normalized values only. Show the raw referrer when the channel is `referral` or
`other`. Omit empty lines rather than printing `unknown` five times. When nothing was
captured, say so on one explicit line, so a blank section is never ambiguous.

This package stores nothing, so the email carries the attribution and the block has
to read on its own.

---

## 11. QA Matrix

Every row asserts two things. The submission succeeds, and attribution resolves to
the expected value or a clean fallback.

| Scenario | Expected |
|---|---|
| Organic search | `google / organic` · organic-search |
| Paid search (`gclid`) | `google / cpc` · paid-search |
| Paid search (`msclkid`) | `bing / cpc` · paid-search |
| Tagged email campaign | `newsletter / email` · email |
| Social referral | `facebook / organic-social` |
| AI assistant referral | `chatgpt / ai-referral` |
| Plain referral | `example-com / referral` |
| Direct, no referrer | `direct / none` |
| Paid click, later direct return | paid retained, as last non-direct |
| Organic first, later paid click | paid wins, first touch keeps organic |
| Internal navigation before submit | unchanged |
| Localized route switch | unchanged |
| localStorage blocked | submits, `unknown` |
| Storage cleared mid-session | submits, recaptured or `unknown` |
| Malformed or hostile parameter values | sanitized, capped, submits |
| Oversized payload above 2 KB | dropped, submits |
| Capture module throws | submits, `unknown` |
| Referrer trimmed to origin | domain-level classification |
| Submitted from a page other than the landing page | landing page retained |

The last several rows protect revenue. Treat them as the priority.

---

## 12. Build Order

1. `core/`. Types, classify, normalize, with unit tests. Pure functions, no I/O.
2. `server/parse.ts`. Validation, caps, sanitization.
3. `client/capture.ts`. Capture and persistence.
4. Adapters and email rendering.
5. Reference integration.
6. QA matrix.
7. Docs, then tag `v1.0.0`.

Steps 1 and 2 carry the logic worth testing.

---

## 13. Acceptance Criteria

- Submissions succeed in every row of §11, including the failure rows.
- Attribution never blocks, delays, or fails a submission. A test forces the capture
  module to throw and proves it.
- Normalization runs exactly once, server-side.
- The email shows normalized source and medium, and says so explicitly when nothing
  was captured.
- Core has no Astro, platform, or DOM imports.
- A site can integrate from `docs/` alone.
- Target sites depend on a pinned tag rather than a copy.
