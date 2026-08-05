/** How the attribution for a touch was determined. */
export type CaptureMethod = 'utm' | 'click-id' | 'referrer' | 'direct' | 'unknown';

/** Normalized channel, aligned to common analytics channel groups. */
export type Channel =
  | 'paid-search'
  | 'organic-search'
  | 'paid-social'
  | 'organic-social'
  | 'ai-referral'
  | 'email'
  | 'referral'
  | 'direct'
  | 'other';

/** A single arrival at the site. Keys are short because this is serialized. */
export interface Touch {
  /** Raw source, as captured. */
  src: string | null;
  /** Raw medium, as captured. */
  med: string | null;
  /** Raw campaign, as captured. */
  cmp: string | null;
  /** Full referrer URL, or empty string. */
  ref: string;
  /** Landing path. */
  lp: string;
  /** ISO timestamp. */
  ts: string;
  /** How this touch was classified. */
  m: CaptureMethod;
}

/** What gets written to storage. */
export interface AttributionRecord {
  /** Schema version. Bump when the shape changes. */
  v: number;
  /** First touch ever seen. Written once, never replaced. */
  first: Touch;
  /** Most recent non-direct touch. Equals `first` when there has been none. */
  last: Touch;
  /** Ad click identifiers, keyed by parameter name. */
  ids: Record<string, string>;
  /** Touch count, for debugging. */
  n: number;
}

/** What the server produces and downstream systems consume. */
export interface NormalizedAttribution {
  source: string;
  medium: string;
  channel: Channel;
  campaign: string | null;
  landing_page: string | null;
  referrer_domain: string | null;
  capture_method: CaptureMethod;
  first_touch_source: string | null;
  first_touch_at: string | null;
  click_ids: Record<string, string>;
}

/** Raw signals available at the moment of a page load. */
export interface CaptureInput {
  /** Query string, with or without a leading "?". */
  query: string;
  /** document.referrer, or empty string. */
  referrer: string;
  /** Hostname of the page being loaded, used to detect internal navigation. */
  host: string;
  /** Path of the page being loaded. */
  path: string;
  /** ISO timestamp. Injected so classification stays pure and testable. */
  now: string;
}
