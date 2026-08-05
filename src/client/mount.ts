import { getAttribution, type CaptureOptions } from './capture.js';

export const FIELD_NAME = 'attribution';

/**
 * Add the attribution record to a form as a hidden input, for forms that post
 * natively rather than serializing a JSON body themselves.
 *
 * Re-mounting is safe. Call again before submit if the form is long-lived.
 */
export function mountHiddenFields(
  form: HTMLFormElement | null,
  options: CaptureOptions & { fieldName?: string } = {},
): void {
  try {
    if (!form) return;
    const name = options.fieldName ?? FIELD_NAME;
    const record = getAttribution(options);

    let input = form.querySelector<HTMLInputElement>(`input[name="${name}"]`);
    if (!record) {
      input?.remove();
      return;
    }

    if (!input) {
      input = document.createElement('input');
      input.type = 'hidden';
      input.name = name;
      form.appendChild(input);
    }
    input.value = JSON.stringify(record);
  } catch {
    /* A form that cannot carry attribution still submits. */
  }
}

/**
 * Keep hidden fields current for the life of the page. Mounts now, refreshes on
 * submit so a form left open overnight still carries the record.
 */
export function autoMount(
  form: HTMLFormElement | null,
  options: CaptureOptions & { fieldName?: string } = {},
): void {
  try {
    if (!form) return;
    mountHiddenFields(form, options);
    form.addEventListener('submit', () => mountHiddenFields(form, options), { capture: true });
  } catch {
    /* nothing to do */
  }
}
