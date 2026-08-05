import type { CaptureInput, Channel, Touch } from './types.js';
/**
 * Lowercase, collapse whitespace and underscores to hyphens, strip anything
 * that is not URL-safe. Applied to every value that reaches a report, so the
 * same channel spelled two ways lands in one row.
 */
export declare function slug(value: unknown): string;
/** Trim to a safe length without slugifying. For referrers and paths. */
export declare function clip(value: unknown, max?: number): string;
/**
 * Hostname of a referrer, lowercased and stripped of "www.".
 * Returns empty string for anything unparseable, which includes the
 * `android-app://` and origin-only referrers browsers increasingly send.
 */
export declare function referrerHost(referrer: string): string;
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
export declare function classifyHost(host: string): {
    source: string;
    medium: string;
} | null;
/** Classify an external referrer into a source and medium. */
export declare function classifyReferrer(referrer: string): {
    source: string;
    medium: string;
};
/** Map a normalized source and medium onto a channel. */
export declare function toChannel(source: string, medium: string): Channel;
/** Apply alias tables. Unknown values pass through slugified. */
export declare function canonicalSource(raw: string): string;
export declare function canonicalMedium(raw: string): string;
/** Ad click identifiers present in the query string. */
export declare function extractClickIds(query: string): Record<string, string>;
/** True when the referrer is the site itself. */
export declare function isInternal(referrer: string, host: string): boolean;
/**
 * Turn one page load into a touch.
 *
 * Precedence is campaign tags, then ad click identifiers, then referrer, then
 * direct. Returns null when this page load is internal navigation rather than
 * an arrival, so browsing the site never overwrites how the visitor got here.
 */
export declare function classify(input: CaptureInput): Touch | null;
/** A touch that carries no attribution signal. */
export declare function isDirectTouch(touch: Touch): boolean;
