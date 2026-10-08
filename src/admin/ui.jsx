import { useEffect, useState } from 'react'
import { api } from '../api.js'

// GET an admin endpoint; keeps the last data while reloading
export function useLoad(path) {
  const [state, setState] = useState({})
  const [tick, setTick] = useState(0)
  useEffect(() => {
    let live = true
    setState((s) => ({ ...s, loading: true }))
    api(path).then((r) => {
      if (!live) return
      if (r.ok) setState({ data: r.data })
      else setState({ offline: r.offline, error: r.offline ? null : (r.data?.error ?? 'error') })
    })
    return () => { live = false }
  }, [path, tick])
  return { ...state, reload: () => setTick((t) => t + 1) }
}

// Loading / offline / error states around a view
export function Gate({ state, children }) {
  if (state.offline) return <p className="adm-empty">The admin needs the database.</p>
  if (state.error) {
    return (
      <p className="adm-empty adm-err">
        {state.error === 'forbidden' ? 'Admins only.' : state.error === 'unauthorized' ? 'Your session expired. Log in again.' : 'Could not load this view.'}{' '}
        <button className="adm-link" onClick={state.reload}>Retry</button>
      </p>
    )
  }
  if (!state.data) return <p className="adm-empty">Loading…</p>
  return children(state.data)
}

export const Status = ({ value }) => <span className={`adm-chip s-${value}`}>{value.replace('_', ' ')}</span>

export const when = (d) =>
  new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

export const day = (d) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

// Rp 12,4 jt style for axes and tiles
export const shortRp = (n) =>
  n >= 1e9 ? `Rp ${(n / 1e9).toFixed(1).replace('.', ',')} M` : n >= 1e6 ? `Rp ${(n / 1e6).toFixed(n >= 1e8 ? 0 : 1).replace('.', ',')} jt` : n >= 1e3 ? `Rp ${Math.round(n / 1e3)} rb` : `Rp ${n}`

export function PageHead({ title, sub, children }) {
  return (
    <header className="adm-head">
      <div>
        <div className="adm-label">{sub}</div>
        <h1>{title}</h1>
      </div>
      {children}
    </header>
  )
}
