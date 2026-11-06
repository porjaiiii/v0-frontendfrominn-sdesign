/**
 * A LINE ID token shaped like the real thing, for client tests.
 *
 * The signature is nonsense — nothing on the client verifies it. What matters
 * is that the payload is readable base64url JSON with an `exp`, because
 * lib/line-id-token.ts reads that claim to decide whether to send the token at
 * all. A plain string like 'fake-line-id-token' now counts as expired.
 */
export function fakeLineIdToken(expiresInSeconds = 3600): string {
  const encode = (obj: object) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds

  return [
    encode({ alg: 'ES256', typ: 'JWT' }),
    encode({ iss: 'https://access.line.me', sub: 'U_test_user', exp }),
    'test-signature',
  ].join('.')
}
