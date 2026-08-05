import type { NormalizedAttribution } from '../core/types.js';
export interface FormatOptions {
    /** Heading above the block. */
    title?: string;
    /** Shown when nothing was captured, so an empty block is never ambiguous. */
    emptyLabel?: string;
}
/** True when there is nothing worth printing. */
export declare function isUnattributed(a: NormalizedAttribution): boolean;
/** Plain text block, appended to a notification email. */
export declare function formatForEmail(attribution: NormalizedAttribution, options?: FormatOptions): string;
/** HTML block, matching the plain text version. */
export declare function formatForEmailHtml(attribution: NormalizedAttribution, options?: FormatOptions): string;
