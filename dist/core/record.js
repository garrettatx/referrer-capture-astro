import { classify, extractClickIds, isDirectTouch } from './classify.js';
export const SCHEMA_VERSION = 1;
export const DEFAULT_LOOKBACK_DAYS = 90;
/**
 * Fold a page load into the stored record.
 *
 * `first` is written once and never replaced. `last` advances only on a
 * non-direct touch, so a visitor who arrives from an ad, leaves, and returns
 * through a bookmark keeps the ad. Internal navigation is not a touch at all.
 *
 * Pure, so the merge rules can be tested without a browser.
 */
export function applyTouch(existing, input) {
    const touch = classify(input);
    if (!touch)
        return existing;
    const ids = extractClickIds(input.query);
    if (!existing) {
        return {
            v: SCHEMA_VERSION,
            first: touch,
            last: touch,
            ids,
            n: 1,
        };
    }
    const next = {
        ...existing,
        v: SCHEMA_VERSION,
        n: existing.n + 1,
        ids: Object.keys(ids).length > 0 ? { ...existing.ids, ...ids } : existing.ids,
    };
    if (!isDirectTouch(touch))
        next.last = touch;
    return next;
}
/** True when the record is too old to trust, measured from the last real touch. */
export function isExpired(record, now, lookbackDays = DEFAULT_LOOKBACK_DAYS) {
    const last = Date.parse(record.last?.ts ?? '');
    const current = Date.parse(now);
    if (Number.isNaN(last) || Number.isNaN(current))
        return true;
    return current - last > lookbackDays * 86_400_000;
}
/** Reject anything that is not a record this version understands. */
export function isValidRecord(value) {
    if (typeof value !== 'object' || value === null)
        return false;
    const r = value;
    if (r.v !== SCHEMA_VERSION)
        return false;
    if (!isTouch(r.first) || !isTouch(r.last))
        return false;
    if (typeof r.n !== 'number')
        return false;
    if (typeof r.ids !== 'object' || r.ids === null)
        return false;
    return true;
}
function isTouch(value) {
    if (typeof value !== 'object' || value === null)
        return false;
    const t = value;
    return typeof t.ts === 'string' && typeof t.ref === 'string' && typeof t.lp === 'string';
}
