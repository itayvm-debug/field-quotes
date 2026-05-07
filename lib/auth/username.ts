const INTERNAL_DOMAIN = 'field-quotes.internal'

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase().replace(/\s+/g, '-')
}

export function usernameToInternalEmail(username: string): string {
  return normalizeUsername(username) + '@' + INTERNAL_DOMAIN
}

export function deriveUsernameFromEmail(email: string): string {
  if (email.endsWith('@' + INTERNAL_DOMAIN)) {
    return email.replace('@' + INTERNAL_DOMAIN, '').toUpperCase()
  }
  return ''
}

export function isInternalEmail(email: string): boolean {
  return email.endsWith('@' + INTERNAL_DOMAIN)
}
