import type { NormalizedAttribution } from '../core/types.js';
import { type FormatOptions } from '../server/format.js';
/** Whole-body cap. The attribution field carries its own 2 KB limit inside this. */
export declare const MAX_BODY_BYTES = 10240;
export interface AttributionBlocks {
    attribution: NormalizedAttribution;
    text: string;
    html: string;
}
/**
 * Everything a Cloudflare Pages Function needs, in one call.
 *
 * Give it the parsed request body, get back the normalized record and both
 * email blocks. Never throws, so it can sit inside a handler without a
 * try/catch and cannot fail the submission it belongs to.
 */
export declare function attributionForNotification(body: Record<string, unknown> | null | undefined, options?: FormatOptions & {
    field?: string;
}): AttributionBlocks;
/**
 * True when a request body is larger than we are willing to parse.
 *
 * Pass `request.headers.get('content-length')`. Reject before reading the body,
 * so an oversized payload costs nothing.
 */
export declare function isBodyTooLarge(contentLength: string | null, max?: number): boolean;
