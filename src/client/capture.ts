import type { AttributionRecord } from '../core/types.js';
import { applyTouch, DEFAULT_LOOKBACK_DAYS, isExpired, isValidRecord } from '../core/record.js';
import { createStore, type Store } from './storage.js';

export const STORAGE_KEY = 'rc_attr';

export interface CaptureOptions {
  /** How long the browser keeps the record. Defaults to 90 days. */
  lookbackDays?: number;
  /** Return false to skip capture entirely. Wire a consent platform in here. */
  shouldCapture?: () => boolean;
  /** Storage key override, for running more than one instance. */
  storageKey?: string;
}

let store: Store | null = null;
function getStore(): Store {
  if (!store) store = createStore();
  return store;
}

function read(key: string): AttributionRecord | null {
  const raw = getStore().get(key);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isValidRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function write(key: string, record: AttributionRecord): void {
  try {
    getStore().set(key, JSON.stringify(record));
  } catch {
    /* Storage is best effort. Never let it surface. */
  }
}

/**
 * Record how this visitor arrived. Call on every page load.
 *
 * Safe to call repeatedly. Internal navigation is not treated as an arrival, so
 * browsing the site never overwrites the original source. Never throws.
 */
export function capture(options: CaptureOptions = {}): AttributionRecord | null {
  try {
    if (typeof window === 'undefined' || typeof document === 'undefined') return null;
    if (options.shouldCapture && options.shouldCapture() !== true) return null;

    const key = options.storageKey ?? STORAGE_KEY;
    const lookback = options.lookbackDays ?? DEFAULT_LOOKBACK_DAYS;
    const now = new Date().toISOString();

    let existing = read(key);
    if (existing && isExpired(existing, now, lookback)) existing = null;

    const next = applyTouch(existing, {
      query: window.location.search,
      referrer: document.referrer || '',
      host: window.location.hostname,
      path: window.location.pathname,
      now,
    });

    if (next && next !== existing) write(key, next);
    return next;
  } catch {
    return null;
  }
}

/** The stored record, or null. Never throws. */
export function getAttribution(options: CaptureOptions = {}): AttributionRecord | null {
  try {
    const key = options.storageKey ?? STORAGE_KEY;
    const lookback = options.lookbackDays ?? DEFAULT_LOOKBACK_DAYS;
    const record = read(key);
    if (!record) return null;
    if (isExpired(record, new Date().toISOString(), lookback)) return null;
    return record;
  } catch {
    return null;
  }
}

/** Clear the stored record. For consent withdrawal and debugging. */
export function clearAttribution(options: CaptureOptions = {}): void {
  try {
    getStore().remove(options.storageKey ?? STORAGE_KEY);
  } catch {
    /* nothing to do */
  }
}

/** Which storage backend is in use. For debugging. */
export function storageKind(): string {
  try {
    return getStore().kind;
  } catch {
    return 'unavailable';
  }
}
