/**
 * Canonical spellings. Campaign tags are written by hand across ad platforms,
 * email tools, and spreadsheets, so the same channel arrives spelled several
 * ways. Collapsing them here is what stops a report from splitting one channel
 * into four rows.
 */
/** Medium aliases. Keys are already slugified when looked up. */
export declare const MEDIUM_ALIASES: Record<string, string>;
/** Source aliases. */
export declare const SOURCE_ALIASES: Record<string, string>;
/**
 * Ad click identifiers worth capturing, mapped to the source and medium they
 * imply when no campaign tag says otherwise.
 *
 * `fbclid` is deliberately not treated as paid. Facebook appends it to every
 * outbound link, organic posts included, so inferring an ad from it would
 * credit paid social for traffic nobody paid for.
 */
export declare const CLICK_IDS: Record<string, {
    source: string;
    medium: string;
}>;
/** Ad click identifiers that indicate paid traffic, for capture_method. */
export declare const PAID_CLICK_IDS: Set<string>;
