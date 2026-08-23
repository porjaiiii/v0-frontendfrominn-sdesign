import { z } from 'zod'

// Shared primitives and the request-parsing helpers every migrated route uses.
//
// A note on what is deliberately ABSENT: none of the authenticated write
// schemas accept `user_id`. Identity comes from the verified LINE ID token
// (lib/auth/verify-line-token.ts). Accepting a caller-supplied user id in the
// body is precisely how /api/points became an open minting endpoint.

/**
 * A LINE user id. No format check: prod contains `demo_user` and `Usample*`
 * alongside real `U...` ids, and rejecting them would break existing accounts.
 */
export const lineUserIdSchema = z.string().min(1).max(128)

/**
 * Client-generated per submit press (crypto.randomUUID(), held in a useRef so
 * retries reuse it) and sent as the `Idempotency-Key` header.
 *
 * Not restricted to UUID — any opaque token is fine, and locking the format
 * down would make it harder to replay a request from a log.
 */
export const idempotencyKeySchema = z.string().min(8).max(200)

export const isoTimestampSchema = z.string().datetime({ offset: true })

/** Reads and validates the Idempotency-Key header. Absent is allowed. */
export function readIdempotencyKey(request: Request): string | null {
  const raw = request.headers.get('idempotency-key')
  if (!raw) return null
  const parsed = idempotencyKeySchema.safeParse(raw.trim())
  return parsed.success ? parsed.data : null
}

export interface ParseFailure {
  ok: false
  status: 400
  body: { success: false; error: string; issues: { path: string; message: string }[] }
}

export type ParseOutcome<T> = { ok: true; data: T } | ParseFailure

function toFailure(error: z.ZodError): ParseFailure {
  return {
    ok: false,
    status: 400,
    body: {
      success: false,
      error: 'Invalid request',
      issues: error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    },
  }
}

/**
 * Validates an already-parsed value (query params, a decoded body, …).
 *
 * The schema's Input is left as `any` — a schema chaining `.transform()`
 * (e.g. an empty-string-to-null normaliser) legitimately has an Input type
 * that differs from its Output T, which `z.ZodType<T>` alone (Input
 * defaulting to T) rejects.
 */
export function parseWith<T>(schema: z.ZodType<T, z.ZodTypeDef, any>, value: unknown): ParseOutcome<T> {
  const result = schema.safeParse(value)
  return result.success ? { ok: true, data: result.data } : toFailure(result.error)
}

/** Validates a JSON request body, treating malformed JSON as a 400. */
export async function parseJsonBody<T>(
  request: Request,
  schema: z.ZodType<T, z.ZodTypeDef, any>,
): Promise<ParseOutcome<T>> {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return {
      ok: false,
      status: 400,
      body: {
        success: false,
        error: 'Invalid request',
        issues: [{ path: '', message: 'Body is not valid JSON' }],
      },
    }
  }
  return parseWith(schema, raw)
}

/** Validates URLSearchParams as a flat record. */
export function parseSearchParams<T>(
  searchParams: URLSearchParams,
  schema: z.ZodType<T>,
): ParseOutcome<T> {
  return parseWith(schema, Object.fromEntries(searchParams.entries()))
}
