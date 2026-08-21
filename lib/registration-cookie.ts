const COOKIE_NAME = 'registered_line_id'
const MAX_AGE_SECONDS = 60 * 60 * 24 // 24h — bounds how stale the cache can get

export function getCachedRegisteredLineId(): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

export function setCachedRegisteredLineId(lineUserId: string): void {
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(lineUserId)}; path=/; max-age=${MAX_AGE_SECONDS}`
}
