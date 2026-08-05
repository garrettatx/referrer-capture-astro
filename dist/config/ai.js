/**
 * AI assistant referrers.
 *
 * These are visits from a person who followed a citation in an AI answer, not
 * crawlers. They convert like search traffic and are worth separating from
 * generic `referral`, which is where most analytics tools file them.
 */
export const AI_ASSISTANTS = {
    'chatgpt.com': 'chatgpt',
    'chat.openai.': 'chatgpt',
    'openai.com': 'chatgpt',
    'perplexity.ai': 'perplexity',
    'claude.ai': 'claude',
    'anthropic.com': 'claude',
    'gemini.google.': 'gemini',
    'bard.google.': 'gemini',
    'copilot.microsoft.': 'copilot',
    'copilot.cloud.microsoft': 'copilot',
    'you.com': 'you',
    'phind.com': 'phind',
    'poe.com': 'poe',
    'grok.com': 'grok',
    'x.ai': 'grok',
    'deepseek.com': 'deepseek',
    'mistral.ai': 'mistral',
    'kagi.com': 'kagi',
};
