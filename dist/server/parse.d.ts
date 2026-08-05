import type { NormalizedAttribution } from '../core/types.js';
/** Anything larger than this is not a real attribution record. */
export declare const MAX_PAYLOAD_BYTES = 2048;
/**
 * Validate, cap, and normalize whatever arrived on the request.
 *
 * Never throws. A missing, malformed, oversized, or hostile payload returns the
 * unattributed record so the submission it belongs to still succeeds. Calling
 * code does not need a try/catch to stay upright, which is the point: a lead is
 * worth more than knowing where it came from.
 */
export declare function parseAttribution(input: unknown): NormalizedAttribution;
/**
 * Read the attribution field out of a submitted form body, in either the JSON
 * shape or the hidden-input shape produced by `mountHiddenFields`.
 */
export declare function attributionFromBody(body: Record<string, unknown> | null | undefined, field?: string): NormalizedAttribution;
