import { type CaptureOptions } from './capture.js';
export declare const FIELD_NAME = "attribution";
/**
 * Add the attribution record to a form as a hidden input, for forms that post
 * natively rather than serializing a JSON body themselves.
 *
 * Re-mounting is safe. Call again before submit if the form is long-lived.
 */
export declare function mountHiddenFields(form: HTMLFormElement | null, options?: CaptureOptions & {
    fieldName?: string;
}): void;
/**
 * Keep hidden fields current for the life of the page. Mounts now, refreshes on
 * submit so a form left open overnight still carries the record.
 */
export declare function autoMount(form: HTMLFormElement | null, options?: CaptureOptions & {
    fieldName?: string;
}): void;
