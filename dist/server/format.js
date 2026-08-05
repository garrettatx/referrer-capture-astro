const DEFAULTS = {
    title: 'Where this lead came from',
    emptyLabel: 'Attribution: none captured (direct visit, or storage blocked)',
};
function rows(a) {
    const out = [];
    out.push(['Source', `${a.source} / ${a.medium}  (${a.channel})`]);
    if (a.campaign)
        out.push(['Campaign', a.campaign]);
    if (a.landing_page)
        out.push(['Landing page', a.landing_page]);
    // The raw domain only helps when the channel itself does not name the source.
    if (a.referrer_domain && (a.channel === 'referral' || a.channel === 'other')) {
        out.push(['Referrer', a.referrer_domain]);
    }
    if (a.first_touch_source && a.first_touch_source !== a.source) {
        const when = a.first_touch_at ? ` on ${a.first_touch_at.slice(0, 10)}` : '';
        out.push(['First touch', `${a.first_touch_source}${when}`]);
    }
    return out;
}
/** True when there is nothing worth printing. */
export function isUnattributed(a) {
    return a.capture_method === 'unknown' || (a.source === 'direct' && a.medium === 'none');
}
/** Plain text block, appended to a notification email. */
export function formatForEmail(attribution, options = {}) {
    const { title, emptyLabel } = { ...DEFAULTS, ...options };
    if (isUnattributed(attribution))
        return `--- ${title} ---\n${emptyLabel}`;
    const pairs = rows(attribution);
    const width = Math.max(...pairs.map(([label]) => label.length)) + 1;
    const body = pairs
        .map(([label, value]) => `${(label + ':').padEnd(width + 1)} ${value}`)
        .join('\n');
    return `--- ${title} ---\n${body}`;
}
/** HTML block, matching the plain text version. */
export function formatForEmailHtml(attribution, options = {}) {
    const { title, emptyLabel } = { ...DEFAULTS, ...options };
    const heading = `<p style="margin-top:1.5rem;font-weight:600;">${escapeHtml(title)}</p>`;
    if (isUnattributed(attribution)) {
        return `${heading}<p style="color:#6b7280;">${escapeHtml(emptyLabel)}</p>`;
    }
    const body = rows(attribution)
        .map(([label, value]) => `<p style="margin:0 0 .25rem;"><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>`)
        .join('\n');
    return `${heading}\n${body}`;
}
function escapeHtml(value) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
