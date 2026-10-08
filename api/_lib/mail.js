// Sends queued emails (email_outbox) over SMTP. Until SMTP_HOST is set, emails simply stay queued
// and go out on the first flush after it is configured. Env: SMTP_HOST, SMTP_PORT (587), SMTP_USER,
// SMTP_PASS, SMTP_FROM ("ORI Support <support@…>"), SMTP_SECURE=true for port 465.
let transport

export const mailConfigured = () => !!process.env.SMTP_HOST

async function getTransport() {
  if (transport) return transport
  const { createTransport } = await import('nodemailer')
  transport = createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  })
  return transport
}

export async function flushOutbox(sql, limit = 10) {
  if (!mailConfigured()) return { configured: false, sent: 0 }
  const [{ jobs }] = await sql`select api_mail_claim(${limit}) as jobs`
  let sent = 0
  for (const job of jobs) {
    try {
      await (await getTransport()).sendMail({ from: process.env.SMTP_FROM ?? process.env.SMTP_USER, to: job.to, subject: job.subject, text: job.body })
      await sql`select api_mail_done(${job.id}, true, null)`
      sent++
    } catch (e) {
      await sql`select api_mail_done(${job.id}, false, ${String(e.message ?? e)})`
    }
  }
  return { configured: true, sent }
}

export const siteUrl = () => (process.env.SITE_URL ?? 'https://ori.kalri.fun').replace(/\/$/, '')
