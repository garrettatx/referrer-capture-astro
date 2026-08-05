/**
 * AI assistant referrers.
 *
 * These are visits from a person who followed a citation in an AI answer, not
 * crawlers. They convert like search traffic and are worth separating from
 * generic `referral`, which is where most analytics tools file them.
 */
export declare const AI_ASSISTANTS: Record<string, string>;
