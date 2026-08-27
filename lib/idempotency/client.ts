/**
 * Browser-side idempotency key. crypto.randomUUID needs a secure context and
 * is missing from some older in-app webviews, so fall back to a random string
 * rather than throwing inside the LINE browser.
 */
export function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `k-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}
