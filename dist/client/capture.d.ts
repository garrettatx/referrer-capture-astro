import type { AttributionRecord } from '../core/types.js';
export declare const STORAGE_KEY = "rc_attr";
export interface CaptureOptions {
    /** How long the browser keeps the record. Defaults to 90 days. */
    lookbackDays?: number;
    /** Return false to skip capture entirely. Wire a consent platform in here. */
    shouldCapture?: () => boolean;
    /** Storage key override, for running more than one instance. */
    storageKey?: string;
}
/**
 * Record how this visitor arrived. Call on every page load.
 *
 * Safe to call repeatedly. Internal navigation is not treated as an arrival, so
 * browsing the site never overwrites the original source. Never throws.
 */
export declare function capture(options?: CaptureOptions): AttributionRecord | null;
/** The stored record, or null. Never throws. */
export declare function getAttribution(options?: CaptureOptions): AttributionRecord | null;
/** Clear the stored record. For consent withdrawal and debugging. */
export declare function clearAttribution(options?: CaptureOptions): void;
/** Which storage backend is in use. For debugging. */
export declare function storageKind(): string;
