/**
 * Canonical spellings. Campaign tags are written by hand across ad platforms,
 * email tools, and spreadsheets, so the same channel arrives spelled several
 * ways. Collapsing them here is what stops a report from splitting one channel
 * into four rows.
 */

/** Medium aliases. Keys are already slugified when looked up. */
export const MEDIUM_ALIASES: Record<string, string> = {
  cpc: 'cpc',
  ppc: 'cpc',
  paidsearch: 'cpc',
  'paid-search': 'cpc',
  'paid-serach': 'cpc',
  adwords: 'cpc',
  'google-ads': 'cpc',
  sem: 'cpc',
  organic: 'organic',
  'organic-search': 'organic',
  seo: 'organic',
  social: 'organic-social',
  'social-organic': 'organic-social',
  'organic-social': 'organic-social',
  'social-media': 'organic-social',
  paidsocial: 'paid-social',
  'paid-social': 'paid-social',
  'social-paid': 'paid-social',
  'cpc-social': 'paid-social',
  email: 'email',
  'e-mail': 'email',
  newsletter: 'email',
  mail: 'email',
  referral: 'referral',
  ref: 'referral',
  affiliate: 'affiliate',
  display: 'display',
  banner: 'display',
  cpm: 'display',
  video: 'video',
  none: 'none',
  '(none)': 'none',
};

/** Source aliases. */
export const SOURCE_ALIASES: Record<string, string> = {
  google: 'google',
  'google-ads': 'google',
  adwords: 'google',
  g: 'google',
  bing: 'bing',
  microsoft: 'bing',
  msn: 'bing',
  fb: 'facebook',
  facebook: 'facebook',
  'facebook-com': 'facebook',
  meta: 'facebook',
  ig: 'instagram',
  instagram: 'instagram',
  li: 'linkedin',
  linkedin: 'linkedin',
  twitter: 'twitter',
  x: 'twitter',
  yt: 'youtube',
  youtube: 'youtube',
  direct: 'direct',
  '(direct)': 'direct',
};

/**
 * Ad click identifiers worth capturing, mapped to the source and medium they
 * imply when no campaign tag says otherwise.
 *
 * `fbclid` is deliberately not treated as paid. Facebook appends it to every
 * outbound link, organic posts included, so inferring an ad from it would
 * credit paid social for traffic nobody paid for.
 */
export const CLICK_IDS: Record<string, { source: string; medium: string }> = {
  gclid: { source: 'google', medium: 'cpc' },
  gbraid: { source: 'google', medium: 'cpc' },
  wbraid: { source: 'google', medium: 'cpc' },
  msclkid: { source: 'bing', medium: 'cpc' },
  ttclid: { source: 'tiktok', medium: 'paid-social' },
  li_fat_id: { source: 'linkedin', medium: 'paid-social' },
  twclid: { source: 'twitter', medium: 'paid-social' },
  fbclid: { source: 'facebook', medium: 'organic-social' },
  igshid: { source: 'instagram', medium: 'organic-social' },
};

/** Ad click identifiers that indicate paid traffic, for capture_method. */
export const PAID_CLICK_IDS = new Set([
  'gclid',
  'gbraid',
  'wbraid',
  'msclkid',
  'ttclid',
  'li_fat_id',
  'twclid',
]);
