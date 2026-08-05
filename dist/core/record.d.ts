import type { AttributionRecord, CaptureInput } from './types.js';
export declare const SCHEMA_VERSION = 1;
export declare const DEFAULT_LOOKBACK_DAYS = 90;
/**
 * Fold a page load into the stored record.
 *
 * `first` is written once and never replaced. `last` advances only on a
 * non-direct touch, so a visitor who arrives from an ad, leaves, and returns
 * through a bookmark keeps the ad. Internal navigation is not a touch at all.
 *
 * Pure, so the merge rules can be tested without a browser.
 */
export declare function applyTouch(existing: AttributionRecord | null, input: CaptureInput): AttributionRecord | null;
/** True when the record is too old to trust, measured from the last real touch. */
export declare function isExpired(record: AttributionRecord, now: string, lookbackDays?: number): boolean;
/** Reject anything that is not a record this version understands. */
export declare function isValidRecord(value: unknown): value is AttributionRecord;
