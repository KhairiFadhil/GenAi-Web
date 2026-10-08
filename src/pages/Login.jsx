import { useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api.js'
import { setAccount, useAccount } from '../store.js'

// Only same-site paths, never `//evil.com`
const safeNext = (n) => (n && n.startsWith('/') && !n.startsWith('//') ? n : null)
const home = (a) => (a.role === 'admin' ? '/admin' : '/account')

const ERRORS = {
  invalid_credentials: 'Email or password is incorrect.',
  too_many_attempts: 'Too many attempts. Try again in 15 minutes.',
  email_taken: 'An account with this email already exists.',
}

export default function Login() {
  const account = useAccount()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))
  const [mode, setMode] = useState(params.get('mode') === 'register' ? 'register' : 'login')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [fields, setFields] = useState({})

  if (account) return <Navigate to={next ?? home(account)} replace />

  const submit = async (e) => {
    e.preventDefault()
    const body = Object.fromEntries(new FormData(e.target))
    setBusy(true)
    setError(null)
    setFields({})
    const r = await api(mode === 'login' ? 'auth/login' : 'auth/register', { body })
    setBusy(false)
    if (r.ok) {
      setAccount(r.data.account)
      return navigate(next ?? home(r.data.account), { replace: true })
    }
    if (r.offline) return setError('Accounts need the database, which is not connected right now.')
    setFields(r.data?.fields ?? {})
    setError(ERRORS[r.data?.error] ?? (r.data?.fields ? 'Please check the highlighted fields.' : 'Something went wrong. Try again.'))
  }

  const field = (name, label, props) => (
    <label>
      {label}
      <input name={name} required aria-invalid={!!fields[name]} aria-describedby={fields[name] ? `${name}-err` : undefined} {...props} />
      {fields[name] && <span id={`${name}-err`} className="field-error">{fields[name]}</span>}
    </label>
  )

  return (
    <div className="page narrow auth-page">
      <div className="label">ORI account</div>
      <h1>{mode === 'login' ? 'Sign in' : 'Create account'}</h1>
      <div className="tabs" role="tablist" aria-label="Account">
        <button role="tab" aria-selected={mode === 'login'} onClick={() => (setMode('login'), setError(null), setFields({}))}>Sign in</button>
        <button role="tab" aria-selected={mode === 'register'} onClick={() => (setMode('register'), setError(null), setFields({}))}>Create account</button>
      </div>

      <form className="stack auth-form" onSubmit={submit} key={mode}>
        {mode === 'register' && field('name', 'Name', { autoComplete: 'name', minLength: 2, maxLength: 80 })}
        {field('email', 'Email', { type: 'email', autoComplete: 'email', maxLength: 120 })}
        {field('password', 'Password', {
          type: 'password', minLength: mode === 'register' ? 8 : undefined, maxLength: 200,
          autoComplete: mode === 'login' ? 'current-password' : 'new-password',
        })}
        {mode === 'register' && <p className="small">At least 8 characters.</p>}
        {error && <p className="notice error" role="alert">{error}</p>}
        <button className="btn primary" disabled={busy}>
          {busy ? <span className="processing"><span className="spinner" /> Please wait</span> : mode === 'login' ? 'Sign in' : 'Create account'}
        </button>
      </form>

      <Link className="link" to="/collection">← Continue shopping</Link>
    </div>
  )
}
