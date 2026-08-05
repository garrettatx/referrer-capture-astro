import type { CaptureInput, CaptureMethod, Channel, Touch } from './types.js';
import { SEARCH_ENGINES } from '../config/search.js';
import { SOCIAL_PLATFORMS } from '../config/social.js';
import { AI_ASSISTANTS } from '../config/ai.js';
import { EMAIL_CLIENTS } from '../config/email.js';
import { CLICK_IDS, MEDIUM_ALIASES, PAID_CLICK_IDS, SOURCE_ALIASES } from '../config/aliases.js';

/** Longest value we will ever keep for a single field. */
const MAX_FIELD = 200;

/**
 * Lowercase, collapse whitespace and underscores to hyphens, strip anything
 * that is not URL-safe. Applied to every value that reaches a report, so the
 * same channel spelled two ways lands in one row.
 */
export function slug(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9.\-+]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, MAX_FIELD);
}

/** Trim to a safe length without slugifying. For referrers and paths. */
export function clip(value: unknown, max = MAX_FIELD): string {
  if (typeof value !== 'string') return '';
  return value.replace(/[\r\n\t]+/g, ' ').trim().slice(0, max);
}

/**
 * Hostname of a referrer, lowercased and stripped of "www.".
 * Returns empty string for anything unparseable, which includes the
 * `android-app://` and origin-only referrers browsers increasingly send.
 */
export function referrerHost(referrer: string): string {
  if (!referrer) return '';
  try {
    return new URL(referrer).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

function lookup(host: string, table: Record<string, string>): string | null {
  for (const fragment in table) {
    if (host.includes(fragment)) return table[fragment] as string;
  }
  return null;
}

/**
 * Match a hostname against the known-platform maps.
 *
 * Returns null when nothing matches, so callers can tell "this is a platform we
 * recognize" from "this is some other website".
 *
 * Order matters. Webmail and AI assistants live on search engine domains
 * (mail.google.com, gemini.google.com), so the specific maps have to be
 * consulted before the general one or every Gmail click reads as organic search.
 */
export function classifyHost(host: string): { source: string; medium: string } | null {
  if (!host) return null;

  const email = lookup(host, EMAIL_CLIENTS);
  if (email) return { source: email, medium: 'email' };

  const ai = lookup(host, AI_ASSISTANTS);
  if (ai) return { source: ai, medium: 'ai-referral' };

  const search = lookup(host, SEARCH_ENGINES);
  if (search) return { source: search, medium: 'organic' };

  const social = lookup(host, SOCIAL_PLATFORMS);
  if (social) return { source: social, medium: 'organic-social' };

  return null;
}

/** Classify an external referrer into a source and medium. */
export function classifyReferrer(referrer: string): { source: string; medium: string } {
  const host = referrerHost(referrer);
  if (!host) return { source: 'direct', medium: 'none' };
  return classifyHost(host) ?? { source: slug(host), medium: 'referral' };
}

/** Map a normalized source and medium onto a channel. */
export function toChannel(source: string, medium: string): Channel {
  switch (medium) {
    case 'cpc':
      return 'paid-search';
    case 'organic':
      return 'organic-search';
    case 'paid-social':
      return 'paid-social';
    case 'organic-social':
      return 'organic-social';
    case 'ai-referral':
      return 'ai-referral';
    case 'email':
      return 'email';
    case 'referral':
      return 'referral';
    case 'none':
      return source === 'direct' || source === '' ? 'direct' : 'other';
    case '':
      return 'other';
    default:
      return 'other';
  }
}

/** Apply alias tables. Unknown values pass through slugified. */
export function canonicalSource(raw: string): string {
  const s = slug(raw);
  return SOURCE_ALIASES[s] ?? s;
}

export function canonicalMedium(raw: string): string {
  const m = slug(raw);
  return MEDIUM_ALIASES[m] ?? m;
}

function parseQuery(query: string): URLSearchParams {
  try {
    return new URLSearchParams(query.startsWith('?') ? query.slice(1) : query);
  } catch {
    return new URLSearchParams();
  }
}

/** Ad click identifiers present in the query string. */
export function extractClickIds(query: string): Record<string, string> {
  const params = parseQuery(query);
  const found: Record<string, string> = {};
  for (const id in CLICK_IDS) {
    const value = params.get(id);
    if (value) found[id] = clip(value, 300);
  }
  return found;
}

/** True when the referrer is the site itself. */
export function isInternal(referrer: string, host: string): boolean {
  const ref = referrerHost(referrer);
  if (!ref) return false;
  const self = host.toLowerCase().replace(/^www\./, '');
  return ref === self || ref.endsWith(`.${self}`) || self.endsWith(`.${ref}`);
}

/**
 * Turn one page load into a touch.
 *
 * Precedence is campaign tags, then ad click identifiers, then referrer, then
 * direct. Returns null when this page load is internal navigation rather than
 * an arrival, so browsing the site never overwrites how the visitor got here.
 */
export function classify(input: CaptureInput): Touch | null {
  const params = parseQuery(input.query);
  const referrer = clip(input.referrer, 500);
  const internal = isInternal(referrer, input.host);

  const utmSource = params.get('utm_source') ?? '';
  const utmMedium = params.get('utm_medium') ?? '';
  const utmCampaign = params.get('utm_campaign') ?? '';
  const clickIds = extractClickIds(input.query);
  const paidClick = Object.keys(clickIds).find((id) => PAID_CLICK_IDS.has(id));
  const anyClick = Object.keys(clickIds)[0];

  const base = {
    ref: referrer,
    lp: clip(input.path, 300),
    ts: input.now,
    cmp: utmCampaign ? slug(utmCampaign) : null,
  };

  // 1. Campaign tags win outright, internal navigation included. A tagged link
  //    to a deep page is a real arrival even if the referrer looks internal.
  if (utmSource || utmMedium) {
    let source = canonicalSource(utmSource);
    let medium = canonicalMedium(utmMedium);
    if (!source && paidClick) source = CLICK_IDS[paidClick]!.source;
    if (!medium && paidClick) medium = CLICK_IDS[paidClick]!.medium;
    if (!source) source = referrer && !internal ? classifyReferrer(referrer).source : 'direct';

    // A source with no medium is common and easy to misfile. AI assistants are
    // the live example: ChatGPT appends utm_source=chatgpt.com to citation
    // links and sets no medium, so defaulting to `referral` buries the arrivals
    // the ai-referral channel exists to surface. Recognize the source as a
    // platform first, then fall back to the referrer, then to referral.
    if (!medium) {
      const bySource = classifyHost(slug(utmSource));
      if (bySource) {
        medium = bySource.medium;
        if (!utmSource || SOURCE_ALIASES[slug(utmSource)] === undefined) source = bySource.source;
      } else if (referrer && !internal) {
        const byReferrer = classifyReferrer(referrer);
        if (byReferrer.medium !== 'none') medium = byReferrer.medium;
      }
    }
    if (!medium) medium = 'referral';
    return { ...base, src: source, med: medium, m: 'utm' as CaptureMethod };
  }

  // 2. An ad click identifier with no tags. Infer from the identifier.
  const inferFrom = paidClick ?? anyClick;
  if (inferFrom) {
    const mapped = CLICK_IDS[inferFrom]!;
    return { ...base, src: mapped.source, med: mapped.medium, m: 'click-id' as CaptureMethod };
  }

  // 3. Internal navigation with nothing to say. Not an arrival.
  if (internal) return null;

  // 4. External referrer.
  if (referrer) {
    const { source, medium } = classifyReferrer(referrer);
    return { ...base, src: source, med: medium, m: 'referrer' as CaptureMethod };
  }

  // 5. No referrer, no tags. Direct.
  return { ...base, src: 'direct', med: 'none', m: 'direct' as CaptureMethod };
}

/** A touch that carries no attribution signal. */
export function isDirectTouch(touch: Touch): boolean {
  return touch.m === 'direct' || (touch.src === 'direct' && touch.med === 'none');
}
