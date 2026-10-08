import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { HttpError, json } from './http.js'

const scryptAsync = promisify(scrypt)
const N = 16384, R = 8, P = 1, KEYLEN = 32
const COOKIE = 'ori_session'
export const SESSION_DAYS = 30

// Stored as scrypt$N$r$p$salt$hash (base64)
export async function hashPassword(password) {
  const salt = randomBytes(16)
  const key = await scryptAsync(password, salt, KEYLEN, { N, r: R, p: P })
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${key.toString('base64')}`
}

// A real-looking hash so unknown emails cost the same time as wrong passwords
const DUMMY = 'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='

export async function verifyPassword(password, stored = DUMMY) {
  const [alg, n, r, p, salt, hash] = stored.split('$')
  if (alg !== 'scrypt') return false
  const expected = Buffer.from(hash, 'base64')
  const key = await scryptAsync(password, Buffer.from(salt, 'base64'), expected.length, { N: +n, r: +r, p: +p })
  return timingSafeEqual(key, expected) && stored !== DUMMY
}

// The browser holds a random token; the database only ever sees its SHA-256
export const newToken = () => randomBytes(32).toString('base64url')
export const tokenHash = (token) => createHash('sha256').update(token).digest('hex')

export function sessionHash(request) {
  const match = (request.headers.get('cookie') ?? '').match(/(?:^|;\s*)ori_session=([A-Za-z0-9_-]{43})(?:;|$)/)
  return match ? tokenHash(match[1]) : null
}

export const sessionCookie = (token) =>
  `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}`
export const clearCookie = () => `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`

export function requireSession(request) {
  const hash = sessionHash(request)
  if (!hash) throw new HttpError(401, 'unauthorized')
  return hash
}

export const PASSWORD = { min: 8, max: 200 }

export const publicAccount = (a) => a && { email: a.email, name: a.name, role: a.role }

// New session cookie for a just-authenticated account
export async function startSession(sql, account, status = 200) {
  const token = newToken()
  await sql`select api_session_create(${account.id}::uuid, ${tokenHash(token)}, ${SESSION_DAYS})`
  return json({ account: publicAccount(account) }, status, { 'set-cookie': sessionCookie(token) })
}
