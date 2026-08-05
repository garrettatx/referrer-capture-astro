# referrer-capture-astro — build plan

Portable lead-attribution capture for Astro sites. Canonical source lives in this
repo; consuming sites depend on it rather than copying it.

Status: plan, not built. Written 2026-08-05 against Pride and Prairie as the first
consumer.

---

## 1. What this is for

One job: **tell the person reading the lead email where that lead came from.**

GA4 already reports source/medium in aggregate. What GA4 cannot do is tell the
person reading the notification that *this specific enquiry* arrived from a Google
organic search on `/services/`.
That per-lead join is the entire value. Everything in this plan is scoped to that,
and anything that does not serve it is out.

That framing matters because the research this plan responds to drifts steadily
toward rebuilding GA4 — confidence scores, storage-state fields, dual raw and
normalized fields on the wire, schema versioning across four layers. Each is
defensible alone. Together they are a tracking project attached to a contact form,
and the contact form is the thing that actually makes money.

---

## 2. Pushback on the incoming spec

The research is good on principles and wrong on several specifics for this stack.
Taking it as written would mean rebuilding a contact pipeline that currently works.

### 2.1 Astro Actions are not available on Pride and Prairie

The spec recommends Astro Actions for the backend in four separate places. P&P is
**pure SSG** — `astro.config.mjs` sets no `output` and no adapter. Actions require
a server runtime. Adopting them means adding `@astrojs/cloudflare`, switching to
`output: 'server'` or hybrid, and rewriting the submission path.

The submission path is a Cloudflare Pages Function at `functions/api/contact.js`
that was just hardened and verified end to end. There is no attribution reason to
replace it. Garrett Digital *does* run the Cloudflare adapter, which is probably
where the Actions advice came from — that is a per-site fact, not a shared one.

**Decision: the package must be transport-agnostic.** Core normalization is a pure
function with no Astro imports. Ship a Pages Function helper for P&P and an Actions
helper for adapter sites. Neither is required to use the core.

### 2.2 "Must work with JavaScript disabled" is already moot

The spec requires JS-disabled support and specifies a server-side referrer parser
as the fallback that delivers it. Neither applies here.

P&P's contact form is a `fetch()` submission behind `e.preventDefault()`. With JS
disabled the form does not submit at all — there is no lead to attribute. Attribution
requiring JS adds **zero** new failure modes.

The server-side fallback is worse than unnecessary; on this architecture it barely
works. Pages are static HTML served from Cloudflare's edge cache. The Function only
runs on the `POST /api/contact/`, by which point `Referer` is the P&P contact page
itself. The original external referrer is long gone. Recovering it server-side would
require middleware on every HTML request, which costs full-page caching on a site
whose pitch is "loads in under a second."

**Decision: client-side capture only. Cut the server-side referrer parser.** The
server still normalizes and sanitizes — that stays, and it is where the real work
happens.

### 2.3 localStorage, not cookies

The spec leads with cookies. Cookies are only better when the server needs to read
them, and here nothing server-side does. Meanwhile every cookie rides along on every
request — HTML, CSS, fonts, images — for zero benefit.

Garrett Digital's existing tracker sets **nine** cookies on `.garrettdigital.com`.
That is a few hundred bytes added to every asset request on every page.

**Decision: one versioned `localStorage` record.** `sessionStorage` fallback if
`localStorage` throws (Safari private mode, storage-partitioned iframes). If both
fail, capture in-memory for the current page and carry on.

### 2.4 The field list is roughly twice the size it needs to be

Fifteen `refcap_` hidden inputs, with raw and normalized variants both on the wire,
plus `capture_confidence`, `storage_state`, and `consent_state`.

Two problems. First, P&P's form does not serialize DOM inputs at all — it builds a
JSON body by hand, so hidden fields are not even the mechanism here. Second,
shipping raw *and* normalized from the client means normalizing twice in two places,
which is exactly how the two drift apart.

**Decision: the client sends raw only, in one compact JSON object. The server
normalizes once.** For sites that use native form posts, the package also exposes
`mountHiddenFields(form)` — the mechanism is a per-site choice, not part of the
contract.

`capture_confidence` is a number nobody will ever act on. Drop it. `capture_method`
(`utm` / `click-id` / `referrer` / `direct`) is worth keeping — it is
self-explanatory and answers "why does this say what it says."

### 2.5 Pick one attribution model and apply it consistently

The GD tracker (`garrettdigital/src/scripts/lead-source-tracker.ts`) documents its
own split brain in the header comment:

```
* - UTM params / gclid: last-touch (overwritten on each new tagged visit)
* - Referrer classification: first-touch (set once, never overwritten)
```

So a visitor who arrives from an ad, leaves, and returns via organic search keeps
the ad as source. A visitor who arrives from organic, leaves, and returns via ad
gets the ad. Same journey shape, different answers depending on which touch was
tagged. This is the "strategically ambiguous" failure the research warns about, and
it is live today.

**Decision: store first touch and last non-direct touch. Apply the same rule to
UTMs and referrers. Report last non-direct touch as primary.** Direct visits never
overwrite a known source. Both are cheap to keep and answer different questions.

### 2.6 Keep the AI-referral channel

The incoming spec's channel list omits it. The existing GD tracker already
classifies `chatgpt`, `perplexity`, `claude`, `gemini`, and `copilot` as
`ai-referral`.

For an SEO agency in 2026 this is arguably the single most interesting line in the
email. It is prior art worth carrying forward, not dropping because a generic spec
did not think of it.

### 2.7 Consent: do not build a CMP

The spec treats consent as a hard gate, weighted toward EU CMP requirements. Not
every consuming site runs a CMP, and several already load analytics directly.

**Decision: ship a `shouldCapture()` config hook, default permissive, documented.**
Sites that need a consent gate wire their CMP into that hook. This package does not
build consent UI and does not assume one exists.

### 2.8 Skip hidden-field tamper detection

The stakes are a wrong word in an email. Signing the payload is real complexity for
no protection. Sanitize, length-cap, and allow-list before anything reaches a
header or an email body. That is the whole threat model.

### 2.9 "Copy it in, but keep this canonical with a link" is contradictory

A copy does not update when the canonical improves. Resolved in §7.

### 2.10 Repo name

You said `referrer-capture-astro`. The pasted spec says `referral-capture-astro`
throughout. I have used **`referrer-capture-astro`** — your wording, and more
accurate, since referrer is only one of the signals but "referral" is also a
specific channel name, which would be confusing.

---

## 3. Scope

**In**

- Client capture of UTMs, ad click IDs, and referrer on landing.
- First-party persistence across the session, surviving internal navigation and
  the `/` ↔ `/es/` language switch.
- Server-side normalization to a stable source / medium / channel taxonomy.
- Two or three readable lines in the notification email.
- Portable package, consumed by P&P first.

**Out**

- Form storage / database. Explicitly cut by you. See §10 for what that implies.
- Multi-touch attribution, paid-media reporting, dashboards.
- Consent UI.
- Replacing or duplicating GA4.
- Any change that makes lead capture depend on attribution succeeding.

---

## 4. Attribution model

| | Rule |
|---|---|
| Primary reported value | Last non-direct touch |
| Also stored | First touch |
| Precedence within a touch | UTM params → ad click ID → referrer → direct |
| Overwrite rule | A new **non-direct** touch updates `last`. Direct visits never overwrite. `first` is written once and never changes. |
| Internal navigation | Never counts as a touch. Referrer matching the current host is ignored. |
| Retention | 90 days, configurable. Record carries `v` for schema migration. |

Language switches (`/contact/` → `/es/contact/`) are internal navigation and must
not reset attribution. This is a real path on P&P and belongs in the test matrix.

---

## 5. Data contract

### Stored record (localStorage, key `rc_attr`)

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

### Wire payload

The client adds **one** key to the existing JSON POST body:

```jsonc
"attribution": { /* the record above, serialized, hard-capped at 2 KB */ }
```

Nothing else changes in the request. If the key is missing, malformed, oversized,
or fails to parse, the server drops it and processes the lead normally.

The attribution blob is a new untrusted input, so the 2 KB cap on it must sit inside
a whole-body size cap on the endpoint. Consuming sites that do not already cap
request bodies need to add one as part of integration.

### Normalized output (server, never sent by the client)

`source` · `medium` · `channel` · `campaign` · `landing_page` · `referrer_domain` ·
`capture_method` · `first_touch_source` · `first_touch_at`

Lowercase, hyphen-separated, no spaces. Unknown → `unknown`. No source → `direct` /
`none`, matching GA4's `(direct) / (none)` convention without the parentheses.

---

## 6. Channel taxonomy

Aligned to GA4 default channel groups, plus `ai-referral`.

| Channel | Trigger |
|---|---|
| `paid-search` | `gclid` / `gbraid` / `wbraid` / `msclkid`, or `utm_medium` in {cpc, ppc, paid-search, paidsearch} |
| `organic-search` | Search-engine referrer with no click ID, or `utm_medium=organic` |
| `paid-social` | `utm_medium` in {paid-social, paidsocial}, or social referrer + click ID |
| `organic-social` | Social-domain referrer, or `utm_medium` in {social, organic-social} |
| `ai-referral` | ChatGPT, Perplexity, Claude, Gemini, Copilot referrer |
| `email` | `utm_medium=email`, or a known mail-client referrer |
| `referral` | Any other external referrer |
| `direct` | No referrer, no UTM, no click ID |
| `other` | Tagged but unmappable |

Domain and alias maps live in `src/config/` as plain data so a site can extend them
without touching core logic. Seed the maps from the existing GD tracker — the search,
social, and AI lists there are already correct and field-tested.

Click IDs to capture: `gclid`, `gbraid`, `wbraid`, `msclkid`, `fbclid`, `ttclid`.
The GD tracker only handles `gclid`.

---

## 7. Distribution — how "canonical with a link" actually works

You asked for the code copied into P&P *and* for this repo to stay canonical *and*
for improvements to propagate. A copy cannot do the third.

**Recommendation: a GitHub-hosted npm dependency, version-pinned.**

```jsonc
// prideandprairie/package.json
"dependencies": {
  "referrer-capture-astro": "github:garrettatx/referrer-capture-astro#v1.0.0"
}
```

- No npm publishing, no registry account, private repo is fine.
- Improvements land here, then each site moves its tag deliberately. No surprise
  changes mid-deploy.
- Cloudflare Pages installs from GitHub at build time with no extra configuration.
- One canonical source, genuinely linked.

Ship prebuilt ESM + `.d.ts` in the repo so consumers need no build step.

Alternatives considered: **git submodule** — propagates, but submodules are a
recurring footgun on CI and for anyone cloning. **Copy + sync script** — what you
described; drifts the moment someone hotfixes a consuming site. **Real npm publish**
— fine later if this ever goes public; unnecessary now.

---

## 8. Repo layout

```
referrer-capture-astro/
├── src/
│   ├── core/
│   │   ├── normalize.ts        # pure: raw record → normalized output
│   │   ├── classify.ts         # referrer/UTM → source, medium, channel
│   │   └── types.ts
│   ├── client/
│   │   ├── capture.ts          # landing capture + persistence
│   │   └── mount.ts            # toJSON() and mountHiddenFields(form)
│   ├── server/
│   │   └── parse.ts            # validate, cap, sanitize, normalize
│   ├── adapters/
│   │   ├── pages-function.ts   # Cloudflare Pages Function (P&P)
│   │   └── astro-action.ts     # adapter sites (Garrett Digital)
│   └── config/
│       ├── search.ts  social.ts  ai.ts  aliases.ts
├── docs/
│   ├── PLAN.md  install.md  integration-astro.md  qa-checklist.md  privacy.md
├── tests/
└── examples/prideandprairie/
```

Core imports nothing from Astro, Cloudflare, or the DOM. That is what makes it
testable and portable.

---

## 9. Pride and Prairie integration

Four touch points, all small:

1. `BaseLayout.astro` — one inline script calling `capture()` on load. No
   hydration, no island. P&P has no view transitions, so a plain script is correct;
   if `ClientRouter` is ever added, re-run on `astro:page-load` per the GA4 pattern
   already established in this workspace.
2. `Contact.astro` — add `attribution: getAttribution()` to the existing JSON body.
   One line.
3. `functions/api/contact.js` — parse, normalize, append to the email. Wrapped in
   try/catch that swallows everything.
4. `package.json` — the dependency.

The non-negotiable: **the `try/catch` around attribution must never be able to fail
a submission.** If normalization throws, the lead sends with `unknown`. This gets an
explicit test.

---

## 10. Email output

Appended to the existing plain-text and HTML bodies:

```
--- Where this lead came from ---
Source:       google / organic  (organic-search)
Campaign:     brand-aug
Landing page: /services/
First touch:  google / organic on Aug 1
```

Rules: normalized values only; raw referrer shown only when the channel is
`referral` or `other`; omit empty lines rather than printing `unknown` five times;
one explicit line when nothing was captured (`Attribution: none captured (direct
or blocked)`) so a blank section is never ambiguous.

Storage is out of scope per your call, so the email carries the attribution. The
only design consequence for this package: the email block has to be self-contained
and readable on its own, since nothing downstream will re-render it.

---

## 11. QA matrix

Every row asserts two things: the lead **submits successfully**, and attribution
resolves to the expected value or a clean fallback.

| Scenario | Expected |
|---|---|
| Google organic | `google / organic` · organic-search |
| Google Ads (`gclid`) | `google / cpc` · paid-search |
| Microsoft Ads (`msclkid`) | `bing / cpc` · paid-search |
| UTM-tagged email | `newsletter / email` · email |
| Facebook referral | `facebook / organic-social` |
| ChatGPT referral | `chatgpt / ai-referral` |
| Plain referral | `example-com / referral` |
| Direct, no referrer | `direct / none` |
| Ad → leaves → returns direct | ad retained (last non-direct) |
| Organic → later ad click | ad wins; first touch keeps organic |
| Internal nav before submit | unchanged |
| `/contact/` → `/es/contact/` | unchanged |
| localStorage blocked | submits; `unknown` |
| Storage cleared mid-session | submits; recaptured or `unknown` |
| Malformed / hostile UTM values | sanitized, length-capped, submits |
| Oversized `attribution` (>2 KB) | dropped, submits |
| Capture module throws | submits; `unknown` |
| Origin-only / trimmed referrer | domain-level classification |
| Submitted from a different page than landing | landing page retained |

The last four are the ones that actually protect revenue.

---

## 12. Build order

1. `core/` — types, classify, normalize, plus unit tests. Pure functions, no I/O.
2. `server/parse.ts` — validation, caps, sanitization.
3. `client/capture.ts` — capture and persistence.
4. Pages Function adapter + email rendering.
5. P&P integration behind the dependency.
6. QA matrix.
7. Docs, then tag `v1.0.0`.

Steps 1–2 are most of the value and carry all the logic worth testing. Nothing
touches P&P until step 5.

---

## 13. Acceptance criteria

- Contact form submits successfully in every row of §11, including the failure rows.
- Attribution never blocks, delays, or fails a submission — proven by a test that
  forces the capture module to throw.
- Normalization runs exactly once, server-side.
- Email shows normalized source and medium, and says so explicitly when nothing
  was captured.
- Core has no Astro, Cloudflare, or DOM imports.
- A second Astro site can integrate from `docs/` alone.
- P&P consumes a pinned tag, not a copy.

---

## 14. Decisions needed from you

1. **GitHub repo** — create `garrettatx/referrer-capture-astro`, public or private?
   Needed before P&P can depend on it.
2. **Retention window** — 90 days proposed. GD currently uses 30.
3. **Migrate Garrett Digital too?** GD's tracker has the split-brain model in §2.5
   and only handles `gclid`. Converging both sites is the point of building this as
   a package, but GD is WordPress + Formidable and a bigger job. Recommend P&P
   first, GD second, as separate work.
