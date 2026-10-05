/**
 * WhatsApp expects a plain international number: country code + number, with
 * no leading '+', spaces, dashes or parentheses.
 * Example: "+91 98765-43210" -> "919876543210"
 */
export function normalisePhone(input) {
  return String(input ?? '').replace(/\D/g, '');
}

export function isValidPhone(input) {
  const digits = normalisePhone(input);
  return digits.length >= 8 && digits.length <= 15;
}

/** Display helper for console output only. */
export function prettyPhone(input) {
  const digits = normalisePhone(input);
  return digits ? `+${digits}` : '(unknown)';
}

export default { normalisePhone, isValidPhone, prettyPhone };
