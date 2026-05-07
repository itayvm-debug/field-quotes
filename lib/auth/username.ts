export const INTERNAL_EMAIL_DOMAIN = 'field-quotes.local'

export function isEmail(input: string): boolean {
  return input.includes('@')
}

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase().replace(/\s+/g, '-')
}

export function usernameToInternalEmail(username: string): string {
  return normalizeUsername(username) + '@' + INTERNAL_EMAIL_DOMAIN
}

/**
 * Converts any login identifier to a Supabase email:
 *   SHAI-ZENATI  →  shai-zenati@field-quotes.local
 *   user@gmail.com  →  user@gmail.com
 */
export function loginIdentifierToEmail(input: string): string {
  const trimmed = input.trim()
  if (isEmail(trimmed)) return trimmed.toLowerCase()
  return usernameToInternalEmail(trimmed)
}

/**
 * Display helper:
 *   shai-zenati@field-quotes.local  →  SHAI-ZENATI
 *   user@gmail.com                  →  user@gmail.com
 */
export function deriveUsernameFromEmail(email: string): string {
  if (email.endsWith('@' + INTERNAL_EMAIL_DOMAIN)) {
    return email.replace('@' + INTERNAL_EMAIL_DOMAIN, '').toUpperCase()
  }
  return email
}

export function isInternalEmail(email: string): boolean {
  return email.endsWith('@' + INTERNAL_EMAIL_DOMAIN)
}
