// Dev-only PII guard. Warns (never blocks) on suspicious keys or values.
// Zero cost in release via __DEV__ gating.

// Note: `name` was previously flagged as PII. Removed from the key-pattern list
// because the product decision is to send the user's display name to Mixpanel
// (see docs/analytics.md §User identification). Other PII shapes (email / phone
// / password) stay flagged — they are never expected in Water Reminder events.
const PII_KEY_PATTERNS: Array<{ re: RegExp; reason: string }> = [
  { re: /email/i, reason: 'email in property key' },
  { re: /phone/i, reason: 'phone in property key' },
  { re: /password/i, reason: 'password in property key' },
];

const EMAIL_VALUE_RE = /[^\s@]+@[^\s@]+\.[^\s@]+/;

export function checkPii(eventName: string, props?: Record<string, unknown>): void {
  if (!__DEV__ || !props) return;
  for (const [key, value] of Object.entries(props)) {
    for (const { re, reason } of PII_KEY_PATTERNS) {
      if (re.test(key)) {
        // eslint-disable-next-line no-console
        console.warn(`[analytics] possible PII in "${eventName}": ${reason} (key="${key}")`);
      }
    }
    if (typeof value === 'string' && EMAIL_VALUE_RE.test(value)) {
      // eslint-disable-next-line no-console
      console.warn(`[analytics] possible PII in "${eventName}": email-like string in "${key}"`);
    }
  }
}
