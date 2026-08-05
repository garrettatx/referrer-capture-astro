# Integration Guide

How to add attribution capture to an Astro site.

The package is not built yet, so treat this as the target. Once `v1.0.0` is tagged,
these steps work as written. Design reasoning lives in [PLAN.md](PLAN.md).

---

## Before You Start

You need three things:

1. An Astro site with a contact form that already works.
2. Somewhere the form submits to. A Cloudflare Pages Function, an Astro Action, or an
   API route. This guide covers all three.
3. Access to whatever sends your notification email.

You do not need to change how your form submits, add a build step, or switch your
site to server rendering.

**Get the form working first.** Attribution attaches to a working submission. If the
form is broken, fix that before adding anything here.

---

## Step 1. Install

```bash
npm install github:garrettatx/referrer-capture-astro#v1.0.0
```

Pin the tag. Do not point at `main`. A pinned tag means the package cannot change
under a deploy you did not intend.

When a new version ships, bump the number and redeploy on purpose.

---

## Step 2. Capture on Every Page

Attribution has to be recorded when the visitor lands, which can be any page, not the
contact page. Add this to your base layout so it runs everywhere.

```astro
---
// src/layouts/BaseLayout.astro
---
<script>
  import { capture } from 'referrer-capture-astro/client';
  capture();
</script>
```

The script reads the URL and referrer, then writes one record to `localStorage`. It
runs once per page load and does nothing visible.

**Using view transitions?** If your site uses Astro's `ClientRouter`, page loads stop
firing normally and you need to re-run capture on each navigation:

```astro
<script>
  import { capture } from 'referrer-capture-astro/client';
  capture();
  document.addEventListener('astro:page-load', capture);
</script>
```

Re-running is safe. A visit that is not a new external touch changes nothing.

---

## Step 3. Attach It to Your Form

Pick the section matching how your form submits.

### If Your Form Posts JSON With fetch()

Add one key to the body you already send:

```js
import { getAttribution } from 'referrer-capture-astro/client';

const res = await fetch('/api/contact/', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: form.name.value,
    email: form.email.value,
    message: form.message.value,
    attribution: getAttribution(),   // <- the only line you add
  }),
});
```

`getAttribution()` never throws. If nothing was captured it returns `null`, and the
server treats that as `unknown`.

### If Your Form Posts Natively

Mount hidden inputs after the page loads:

```js
import { mountHiddenFields } from 'referrer-capture-astro/client';
mountHiddenFields(document.querySelector('#contact-form'));
```

This appends the attribution record as hidden inputs, so it arrives with the rest of
your form fields and needs no change to your handler's parsing.

### If You Use Astro Actions

Same as the JSON case on the client. See Step 4 for the server half.

---

## Step 4. Normalize on the Server

The browser sends raw values. The server turns them into clean, consistent ones. This
happens in one place so the mapping cannot drift.

### Cloudflare Pages Function

```js
import { parseAttribution } from 'referrer-capture-astro/server';

export async function onRequestPost({ request }) {
  const body = await request.json();
  const attribution = parseAttribution(body.attribution);
  // { source: 'google', medium: 'organic', channel: 'organic-search', ... }
}
```

### Astro Action

```js
import { defineAction } from 'astro:actions';
import { parseAttribution } from 'referrer-capture-astro/server';

export const server = {
  submitLead: defineAction({
    handler: async (input) => {
      const attribution = parseAttribution(input.attribution);
    },
  }),
};
```

`parseAttribution` validates, caps length, sanitizes, and returns a safe fallback
instead of throwing. You do not need a try/catch around it.

**One thing to check.** Your endpoint should cap total request body size. The
attribution field is capped at 2 KB, but that only helps if the whole body is capped
too. If your endpoint has no limit, add one, somewhere around 10 KB.

---

## Step 5. Put It in the Email

```js
import { formatForEmail } from 'referrer-capture-astro/server';

const emailBody = [
  `Name: ${name}`,
  `Email: ${email}`,
  '',
  message,
  '',
  formatForEmail(attribution),
].join('\n');
```

Which produces:

```
--- Where this lead came from ---
Source:       google / organic  (organic-search)
Campaign:     brand-aug
Landing page: /services/
First touch:  google / organic on Aug 1
```

When nothing was captured it prints one explicit line saying so, so an empty block is
never ambiguous.

---

## Step 6. Test It

Load your own site with a fake campaign tag, then submit the form:

```
https://yoursite.com/?utm_source=testing&utm_medium=email&utm_campaign=setup-check
```

The email should show `testing / email`. If it does, capture, persistence,
normalization, and rendering all work.

Then test the case that matters more. Open a private window, block storage or
disable JavaScript for the site, and submit again. **The form must still send.** If a
storage failure can stop a submission, something is wired wrong.

The [full QA matrix](PLAN.md#11-qa-matrix) covers the rest: paid clicks, social,
AI assistants, direct visits, and the failure paths.

---

## Configuration

Defaults suit most sites. Override only what you need.

```js
capture({
  lookbackDays: 90,        // how long the visitor's browser keeps the record
  shouldCapture: () => true,  // return false to skip capture entirely
});
```

**`lookbackDays`** matches the default acquisition window in common analytics
platforms, so your email agrees with your reports. Change it only if you have a
reason.

**`shouldCapture`** is where a consent platform plugs in. Return `false` and nothing
is read or written:

```js
capture({ shouldCapture: () => window.myConsentTool?.hasMarketingConsent() === true });
```

This package ships no consent banner and assumes none exists. Check what your
jurisdiction and privacy policy require.

---

## Working With an AI Assistant

If you are handing this to Claude, Copilot, or similar, give it the files rather than
a summary:

> Read `docs/integration.md` and `docs/PLAN.md` from
> github.com/garrettatx/referrer-capture-astro. Add attribution capture to this
> Astro site following that guide. My form is at `<path>` and submits to `<endpoint>`.
> Do not change how the form submits. Attribution must never be able to block a
> submission.

That last sentence carries the weight. It is the one rule the whole design protects,
and it is the one an assistant is most likely to break while tidying up error
handling.

Afterward, check three things yourself:

- The form still submits when `localStorage` is blocked.
- `parseAttribution` runs on the server, not in the browser.
- The dependency is pinned to a tag, not `main`.

---

## Troubleshooting

**Every lead shows `direct / none`.** `capture()` is not running on the landing page.
It belongs in the base layout, not on the contact page. Someone landing on your
homepage and clicking through to contact has no referrer left by the time they get
there.

**Attribution is empty for some visitors.** Expected. Storage can be blocked, cleared,
or partitioned. It records as `unknown` and the lead still arrives.

**Everything shows your own domain as the referrer.** Internal navigation is being
counted as a touch. Confirm the site's own hostname is being excluded.

**Values look inconsistent, like `Google` and `google` both appearing.** Normalization
is running in more than one place, or being skipped. It should run once, server-side,
via `parseAttribution`.

**A campaign tag is not overriding an older source.** Working as designed for direct
visits, which never overwrite. A tagged visit should always update. If it does not,
check that `capture()` runs before the form script reads the record.

---

## Related Docs

- [PLAN.md](PLAN.md). Design decisions, attribution model, channel taxonomy, QA
  matrix, and why each choice was made.
- [README](../README.md). Overview and API summary.
