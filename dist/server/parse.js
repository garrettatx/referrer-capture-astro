import { isValidRecord } from '../core/record.js';
import { normalize, UNATTRIBUTED } from '../core/normalize.js';
/** Anything larger than this is not a real attribution record. */
export const MAX_PAYLOAD_BYTES = 2048;
/**
 * Validate, cap, and normalize whatever arrived on the request.
 *
 * Never throws. A missing, malformed, oversized, or hostile payload returns the
 * unattributed record so the submission it belongs to still succeeds. Calling
 * code does not need a try/catch to stay upright, which is the point: a lead is
 * worth more than knowing where it came from.
 */
export function parseAttribution(input) {
    try {
        const record = toRecord(input);
        if (!record)
            return { ...UNATTRIBUTED };
        return normalize(record);
    }
    catch {
        return { ...UNATTRIBUTED };
    }
}
function toRecord(input) {
    if (input == null)
        return null;
    let value = input;
    if (typeof input === 'string') {
        if (input.length > MAX_PAYLOAD_BYTES)
            return null;
        try {
            value = JSON.parse(input);
        }
        catch {
            return null;
        }
    }
    else {
        // Objects arrive already parsed. Measure them the same way.
        let serialized;
        try {
            serialized = JSON.stringify(input);
        }
        catch {
            return null;
        }
        if (serialized.length > MAX_PAYLOAD_BYTES)
            return null;
    }
    return isValidRecord(value) ? value : null;
}
/**
 * Read the attribution field out of a submitted form body, in either the JSON
 * shape or the hidden-input shape produced by `mountHiddenFields`.
 */
export function attributionFromBody(body, field = 'attribution') {
    if (!body)
        return { ...UNATTRIBUTED };
    return parseAttribution(body[field] ?? null);
}
