# Changelog

## v1.0.1

**Fixed: a campaign source with no medium was misfiled as generic referral.**

Found during live QA. ChatGPT appends `utm_source=chatgpt.com` to citation links and
sets no `utm_medium`. A missing medium defaulted to `referral`, so those arrivals
recorded as `chatgpt.com / referral` and disappeared into exactly the bucket the
`ai-referral` channel exists to rescue them from. The same problem hit
`utm_source=linkedin.com` and any other bare-source tagging.

A missing medium is now resolved by recognizing the source as a known platform, then
falling back to the referrer, then to `referral`. An explicit `utm_medium` still wins,
and unrecognized sources still fall back rather than guessing.

Internal: extracted `classifyHost()` so the campaign path and the referrer path share
one set of platform maps instead of drifting.

## v1.0.0

First release. Core classification and normalization, browser capture with graceful
storage fallback, server-side parsing, email formatting, and a Cloudflare Pages
Function adapter. 98 tests.

Two bugs caught while writing those tests:

- `mail.google.com` and `gemini.google.com` classified as organic search, because the
  search map matched `google.` before the webmail and AI maps were consulted. Every
  Gmail click would have been credited to Google organic.
- `fbclid` was going to imply paid social. Facebook appends it to every outbound link
  including organic posts, so treating it as paid would credit ad spend for traffic
  nobody paid for. It maps to `organic-social`.
