import { Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { logout, useAccount } from '../store.js'
import Overview from './Overview.jsx'
import Orders from './Orders.jsx'
import Products from './Products.jsx'
import Reports from './Reports.jsx'
import Verifications from './Verifications.jsx'
import Customers from './Customers.jsx'
import './admin.css'
import './motion.css'

const NAV = [
  ['/admin', 'Overview'],
  ['/admin/orders', 'Orders'],
  ['/admin/products', 'Products'],
  ['/admin/reports', 'Reports'],
  ['/admin/verifications', 'Verifications'],
  ['/admin/customers', 'Customers'],
]

export default function AdminApp() {
  const account = useAccount()
  const navigate = useNavigate()
  const { pathname } = useLocation()

  if (account === undefined) return <div className="admin adm-boot"><p className="adm-empty">Loading…</p></div>
  if (!account) return <Navigate to="/login?next=/admin" replace />
  if (account.role !== 'admin') {
    return (
      <div className="admin adm-boot">
        <div className="adm-label">403</div>
        <h1>Admins only</h1>
        <p className="adm-muted">You are signed in as {account.email}, which is not an admin account.</p>
        <Link className="adm-btn" to="/">Back to store</Link>
      </div>
    )
  }

  return (
    <div className="admin">
      <aside className="adm-side">
        <Link to="/" className="adm-logo" aria-label="Back to the ORI store">ORI <small>Admin</small></Link>
        <nav className="adm-nav" aria-label="Admin">
          {NAV.map(([to, label]) => <NavLink key={to} to={to} end={to === '/admin'}>{label}</NavLink>)}
        </nav>
        <div className="adm-me">
          <b>{account.name}</b>
          <span>{account.email}</span>
          <button className="adm-link" onClick={() => { navigate('/'); logout() }}>Log out</button>{/* leave first, or the gate redirects to /login */}
        </div>
      </aside>
      <main className="adm-main">
        {/* Keyed by path: each admin page animates in (query-string changes like ?number= don't) */}
        <div className="adm-page" key={pathname}>
        <Routes>
          <Route index element={<Overview />} />
          <Route path="orders" element={<Orders />} />
          <Route path="products" element={<Products />} />
          <Route path="reports" element={<Reports />} />
          <Route path="verifications" element={<Verifications />} />
          <Route path="customers" element={<Customers />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
        </div>
      </main>
    </div>
  )
}
