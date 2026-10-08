import postgres from 'postgres'

let client

// Shared client; null without a database
export function db() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL
  if (!url) return null
  client ??= postgres(url, {
    prepare: false, // pooled connections (PgBouncer)
    max: 1,
    idle_timeout: 20,
    connect_timeout: 8,
    ssl: /@(localhost|127\.0\.0\.1)[:/]|sslmode=disable/.test(url) ? false : 'require', // no TLS for local/private-network DBs
  })
  return client
}
