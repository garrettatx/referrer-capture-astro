import type { NormalizedAttribution } from '../core/types.js';
import { attributionFromBody } from '../server/parse.js';
import { formatForEmail, formatForEmailHtml, type FormatOptions } from '../server/format.js';

/** Whole-body cap. The attribution field carries its own 2 KB limit inside this. */
export const MAX_BODY_BYTES = 10_240;

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
export function attributionForNotification(
  body: Record<string, unknown> | null | undefined,
  options: FormatOptions & { field?: string } = {},
): AttributionBlocks {
  const attribution = attributionFromBody(body, options.field ?? 'attribution');
  return {
    attribution,
    text: formatForEmail(attribution, options),
    html: formatForEmailHtml(attribution, options),
  };
}

/**
 * True when a request body is larger than we are willing to parse.
 *
 * Pass `request.headers.get('content-length')`. Reject before reading the body,
 * so an oversized payload costs nothing.
 */
export function isBodyTooLarge(contentLength: string | null, max = MAX_BODY_BYTES): boolean {
  if (!contentLength) return false;
  const size = Number.parseInt(contentLength, 10);
  return Number.isFinite(size) && size > max;
}
