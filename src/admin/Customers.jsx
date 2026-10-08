import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'
import { rupiah, toast, useAccount } from '../store.js'
import { ago, copy, initials } from './ago.js'
import { Gate, PageHead, Status, day, useLoad, when } from './ui.jsx'
import './support.css'

const FILTERS = [
  ['all', 'All', () => true],
  ['customer', 'Customers', (a) => a.role === 'customer'],
  ['admin', 'Admins', (a) => a.role === 'admin'],
  ['disabled', 'Disabled', (a) => a.disabled],
]
const REASONS = { cannot_change_self: "You can't demote or disable your own account.", email_taken: 'An account with this email already exists.' }

// Temporary password shown exactly once
function TempPassword({ email, password }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="sp-temp" role="status">
      <span className="adm-label">Temporary password for {email}</span>
      <div className="sp-temp-row">
        <code>{password}</code>
        <button type="button" className="sp-btn" onClick={() => copy(password, setCopied)}>{copied ? 'Copied ✓' : 'Copy'}</button>
      </div>
      <span className="adm-muted">Shown once. Share it privately and ask them to sign in and keep it safe.</span>
    </div>
  )
}

// Two-step button for actions that need a second look
function Confirm({ label, question, tone = '', onConfirm, disabled }) {
  const [asking, setAsking] = useState(false)
  if (!asking) return <button type="button" className={`sp-btn ${tone}`} disabled={disabled} onClick={() => setAsking(true)}>{label}</button>
  return (
    <span className="sp-confirm">
      <span>{question}</span>
      <button type="button" className={`sp-btn solid ${tone}`} disabled={disabled} onClick={async () => { await onConfirm(); setAsking(false) }}>Yes</button>
      <button type="button" className="sp-btn" onClick={() => setAsking(false)}>Cancel</button>
    </span>
  )
}

function UserSheet({ email, me, onClose, onChanged }) {
  const state = useLoad(`admin/account?email=${encodeURIComponent(email)}`)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [name, setName] = useState(null) // null = not editing
  const [temp, setTemp] = useState(null)
  const self = email === me

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const act = async (body, done) => {
    setBusy(true)
    setError(null)
    const r = await api('admin/account', { body: { email, ...body } })
    setBusy(false)
    if (!r.ok) return setError(REASONS[r.data?.reason] ?? 'Could not update this account.')
    if (r.data.temporary_password) setTemp(r.data.temporary_password)
    toast(done)
    state.reload()
    onChanged()
  }

  return (
    <div className="sp-sheet-wrap" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="sp-sheet" role="dialog" aria-modal="true" aria-label={`Account ${email}`}>
        <button className="sp-x" onClick={onClose} aria-label="Close">×</button>
        <Gate state={state}>
          {(a) => (
            <>
              <header className="sp-profile">
                <span className={`sp-avatar lg is-${a.role}`}>{initials(a.name)}</span>
                <div>
                  {name === null ? (
                    <h2>{a.name} <button className="sp-link" onClick={() => setName(a.name)}>Edit</button></h2>
                  ) : (
                    <form className="sp-inline" onSubmit={(e) => (e.preventDefault(), act({ action: 'update', name: name.trim() }, 'Name updated').then(() => setName(null)))}>
                      <input className="sp-input" value={name} onChange={(e) => setName(e.target.value)} minLength={2} maxLength={80} required autoFocus aria-label="Name" />
                      <button className="sp-btn primary" disabled={busy || name.trim().length < 2}>Save</button>
                      <button type="button" className="sp-btn" onClick={() => setName(null)}>Cancel</button>
                    </form>
                  )}
                  <span className="adm-muted">{a.email}</span>
                  <div className="sp-pills">
                    <span className={`sp-pill is-${a.role}`}>{a.role}</span>
                    <span className={`sp-pill ${a.disabled ? 'off' : 'on'}`}>{a.disabled ? 'Disabled' : 'Active'}</span>
                    {self && <span className="sp-pill">You</span>}
                  </div>
                </div>
              </header>

              <dl className="sp-stats">
                <div><dt>Orders</dt><dd>{a.orders.length}</dd></div>
                <div><dt>Spent</dt><dd>{rupiah(a.spent)}</dd></div>
                <div><dt>Last login</dt><dd>{ago(a.last_login_at)}</dd></div>
                <div><dt>Sessions</dt><dd>{a.sessions}</dd></div>
              </dl>
              <p className="adm-muted sp-since">Member since {day(a.created_at)}</p>

              {temp && <TempPassword email={a.email} password={temp} />}
              {error && <p className="sp-error" role="alert">{error}</p>}

              <section className="sp-actions" aria-label="Account actions">
                <div className="adm-label">Manage</div>
                {!self && (a.role === 'customer'
                  ? <Confirm label="Make admin" question="Give full admin access?" disabled={busy} onConfirm={() => act({ action: 'update', role: 'admin' }, `${a.name} is now an admin`)} />
                  : <Confirm label="Remove admin" question="Make this a customer account?" disabled={busy} onConfirm={() => act({ action: 'update', role: 'customer' }, `${a.name} is now a customer`)} />)}
                {!self && (a.disabled
                  ? <button className="sp-btn" disabled={busy} onClick={() => act({ action: 'update', disabled: false }, `${a.name} can sign in again`)}>Enable account</button>
                  : <Confirm label="Disable account" tone="danger" question="Sign them out and block sign-in?" disabled={busy} onConfirm={() => act({ action: 'update', disabled: true }, `${a.name} is disabled`)} />)}
                <Confirm label="Reset password" question="Sign out everywhere and issue a temporary password?" disabled={busy} onConfirm={() => act({ action: 'password' }, 'Temporary password created')} />
                {self && <p className="adm-muted">This is your account, so role and access can't be changed here.</p>}
              </section>

              <section className="sp-related">
                <div className="adm-label">Orders</div>
                {a.orders.length ? (
                  <ul>{a.orders.map((o) => (
                    <li key={o.number}><Link to={`/admin/orders?number=${o.number}`} className="mono">{o.number}</Link><Status value={o.status} /><span className="mono">{rupiah(o.total)}</span></li>
                  ))}</ul>
                ) : <p className="adm-muted">No orders yet.</p>}
                <div className="adm-label">Tickets</div>
                {a.reports.length ? (
                  <ul>{a.reports.map((r) => (
                    <li key={r.id}><Link to={`/admin/reports?id=${r.id}`}>{r.subject}</Link><Status value={r.status} /><span className="adm-muted">{when(r.created_at)}</span></li>
                  ))}</ul>
                ) : <p className="adm-muted">No tickets.</p>}
              </section>
            </>
          )}
        </Gate>
      </aside>
    </div>
  )
}

function AddUser({ onClose, onCreated }) {
  const ref = useRef()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(null)
  useEffect(() => { ref.current.showModal() }, [])

  const submit = async (e) => {
    e.preventDefault()
    const body = Object.fromEntries(new FormData(e.target))
    setBusy(true)
    setError(null)
    const r = await api('admin/account', { body: { action: 'create', ...body } })
    setBusy(false)
    if (!r.ok) return setError(r.status === 409 ? REASONS.email_taken : 'Check the name and email and try again.')
    setDone(r.data)
    onCreated()
  }

  return (
    <dialog ref={ref} className="sp-dialog" onClose={onClose} onClick={(e) => e.target === ref.current && ref.current.close()} aria-label="Add user">
      {done ? (
        <div className="sp-dialog-body">
          <h2>{done.name} added</h2>
          <TempPassword email={done.email} password={done.temporary_password} />
          <div className="sp-dialog-foot"><button className="sp-btn primary" onClick={() => ref.current.close()}>Done</button></div>
        </div>
      ) : (
        <form className="sp-dialog-body" onSubmit={submit}>
          <h2>Add user</h2>
          <label>Name<input className="sp-input" name="name" required minLength={2} maxLength={80} autoFocus /></label>
          <label>Email<input className="sp-input" name="email" type="email" required maxLength={120} /></label>
          <label>Role
            <select className="sp-input" name="role" defaultValue="customer">
              <option value="customer">Customer</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <p className="adm-muted">A temporary password is generated and shown once.</p>
          {error && <p className="sp-error" role="alert">{error}</p>}
          <div className="sp-dialog-foot">
            <button type="button" className="sp-btn" onClick={() => ref.current.close()}>Cancel</button>
            <button className="sp-btn primary" disabled={busy}>{busy ? <span className="sp-spin" /> : null} Create user</button>
          </div>
        </form>
      )}
    </dialog>
  )
}

export default function Customers() {
  const state = useLoad('admin/people')
  const me = useAccount()?.email
  const [tab, setTab] = useState('accounts')
  const [filter, setFilter] = useState('all')
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(null)
  const [adding, setAdding] = useState(false)
  const [copied, setCopied] = useState(false)
  const needle = q.trim().toLowerCase()

  return (
    <Gate state={state}>
      {({ accounts, subscribers }) => {
        const counts = Object.fromEntries(FILTERS.map(([k, , fn]) => [k, accounts.filter(fn).length]))
        const shown = accounts.filter(FILTERS.find(([k]) => k === filter)[2]).filter((a) => !needle || `${a.name} ${a.email}`.toLowerCase().includes(needle))
        const subs = subscribers.filter((s) => !needle || s.email.includes(needle))
        return (
          <>
            <PageHead title="Customers" sub="Accounts, access & newsletter">
              <div className="adm-row">
                <div className="sp-summary">
                  <span><b>{counts.customer}</b> customers</span>
                  <span><b>{counts.admin}</b> admins</span>
                  <span className={counts.disabled ? 'warn' : ''}><b>{counts.disabled}</b> disabled</span>
                </div>
                <button className="sp-btn primary" onClick={() => setAdding(true)}>+ Add user</button>
              </div>
            </PageHead>

            <div className="sp-tools">
              <div className="sp-seg" role="tablist" aria-label="View">
                <button role="tab" aria-selected={tab === 'accounts'} onClick={() => setTab('accounts')}>Accounts<span className="adm-count">{accounts.length}</span></button>
                <button role="tab" aria-selected={tab === 'subscribers'} onClick={() => setTab('subscribers')}>Newsletter<span className="adm-count">{subscribers.length}</span></button>
              </div>
              <label className="sp-search">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="11" cy="11" r="6" /><path d="M20 20l-4.5-4.5" /></svg>
                <span className="sr-only">Search</span>
                <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tab === 'accounts' ? 'Search name or email' : 'Search email'} />
              </label>
              {tab === 'accounts' ? (
                <div className="sp-seg" role="tablist" aria-label="Filter accounts">
                  {FILTERS.map(([k, label]) => (
                    <button key={k} role="tab" aria-selected={filter === k} onClick={() => setFilter(k)}>{label}<span className="adm-count">{counts[k]}</span></button>
                  ))}
                </div>
              ) : (
                <button className="sp-btn" onClick={() => copy(subs.map((s) => s.email).join(', '), (ok) => (setCopied(ok), setTimeout(() => setCopied(false), 2000), toast(ok ? `${subs.length} emails copied` : 'Copy failed')))}>
                  {copied ? 'Copied ✓' : `Copy ${subs.length} emails`}
                </button>
              )}
            </div>

            {tab === 'accounts' ? (
              <section className="adm-card flush sp-users" aria-label="Accounts">
                <div className="sp-user sp-headrow" aria-hidden="true">
                  <span>User</span><span>Role</span><span>Status</span><span>Last login</span><span className="r">Orders</span><span className="r">Spent</span>
                </div>
                {shown.map((a, i) => (
                  <button key={a.email} className={`sp-user ${a.disabled ? 'off' : ''}`} style={{ '--i': Math.min(i, 12) }} onClick={() => setOpen(a.email)}>
                    <span className="sp-person">
                      <span className={`sp-avatar is-${a.role}`}>{initials(a.name)}</span>
                      <span><b>{a.name}{a.email === me ? ' (you)' : ''}</b><span className="adm-muted">{a.email}</span></span>
                    </span>
                    <span><span className={`sp-pill is-${a.role}`}>{a.role}</span></span>
                    <span><span className={`sp-pill ${a.disabled ? 'off' : 'on'}`}>{a.disabled ? 'Disabled' : 'Active'}</span></span>
                    <span className="adm-muted sp-login">{ago(a.last_login_at)}</span>
                    <span className="r mono">{a.orders}</span>
                    <span className="r mono sp-spent">{rupiah(a.spent)}</span>
                  </button>
                ))}
                {!shown.length && <p className="adm-empty sp-none">No accounts match.</p>}
              </section>
            ) : (
              <section className="adm-card flush sp-subs" aria-label="Newsletter subscribers">
                <ul>
                  {subs.map((s) => <li key={s.email}><span>{s.email}</span><span className="adm-muted">{day(s.created_at)}</span></li>)}
                  {!subs.length && <li className="adm-empty sp-none">No subscribers match.</li>}
                </ul>
              </section>
            )}

            {open && <UserSheet key={open} email={open} me={me} onClose={() => setOpen(null)} onChanged={state.reload} />}
            {adding && <AddUser onClose={() => setAdding(false)} onCreated={state.reload} />}
          </>
        )
      }}
    </Gate>
  )
}
