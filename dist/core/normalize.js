import { canonicalMedium, canonicalSource, referrerHost, toChannel } from './classify.js';
/** What a submission with no usable attribution produces. */
export const UNATTRIBUTED = {
    source: 'direct',
    medium: 'none',
    channel: 'direct',
    campaign: null,
    landing_page: null,
    referrer_domain: null,
    capture_method: 'unknown',
    first_touch_source: null,
    first_touch_at: null,
    click_ids: {},
};
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
export function normalize(record) {
    if (!record)
        return { ...UNATTRIBUTED };
    const touch = record.last ?? record.first;
    if (!touch)
        return { ...UNATTRIBUTED };
    const source = canonicalSource(touch.src ?? '') || 'direct';
    const medium = canonicalMedium(touch.med ?? '') || 'none';
    return {
        source,
        medium,
        channel: toChannel(source, medium),
        campaign: touch.cmp ? touch.cmp : null,
        landing_page: touch.lp || null,
        referrer_domain: referrerHost(touch.ref) || null,
        capture_method: touch.m ?? 'unknown',
        first_touch_source: record.first ? canonicalSource(record.first.src ?? '') || null : null,
        first_touch_at: record.first?.ts ?? null,
        click_ids: record.ids ?? {},
    };
}
