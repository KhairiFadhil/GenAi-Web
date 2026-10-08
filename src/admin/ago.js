// "3m ago", "2h ago", "5d ago", then a date
export function ago(d) {
  if (!d) return 'never'
  const s = (Date.now() - new Date(d)) / 1000
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d ago`
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export const initials = (name = '') => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '?'

export async function copy(text, done) {
  try {
    await navigator.clipboard.writeText(text)
    done?.(true)
  } catch {
    done?.(false)
  }
}
