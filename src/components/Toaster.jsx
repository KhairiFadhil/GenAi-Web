import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

export default function Toaster() {
  const [toasts, setToasts] = useState([])
  useEffect(() => {
    const add = (e) => {
      const t = e.detail
      setToasts((list) => [...list.slice(-2), t])
      setTimeout(() => setToasts((list) => list.filter((x) => x.id !== t.id)), 3600)
    }
    window.addEventListener('ori-toast', add)
    return () => window.removeEventListener('ori-toast', add)
  }, [])
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div className="toast" key={t.id}>
          <span>{t.message}</span>
          {t.action && <Link to={t.action.to}>{t.action.label}</Link>}
        </div>
      ))}
    </div>
  )
}
