import type { AttributionRecord, NormalizedAttribution } from './types.js';
/** What a submission with no usable attribution produces. */
export declare const UNATTRIBUTED: NormalizedAttribution;
/**
 * Turn a stored record into the canonical values downstream systems read.
 *
 * Reports the last non-direct touch, because it credits the most recent channel
 * that actually referred someone without letting a direct return visit erase
 * it. First touch rides along for analysis.
 *
 * Runs once, server-side. Running it in the browser as well is how two copies
 * of the mapping drift apart.
 */
export declare function normalize(record: AttributionRecord | null): NormalizedAttribution;
