import { rupiah } from '../store.js'
import { Gate, PageHead, day, useLoad } from './ui.jsx'

export default function Customers() {
  const state = useLoad('admin/people')
  return (
    <>
      <PageHead title="Customers" sub="Accounts & newsletter" />
      <Gate state={state}>
        {({ accounts, subscribers }) => (
          <div className="adm-cols wide">
            <section className="adm-card flush">
              <div className="adm-card-head pad"><h2>Accounts</h2><span className="adm-muted">{accounts.length}</span></div>
              <div className="adm-scroll">
                <table className="adm-table">
                  <thead><tr><th>Name</th><th>Role</th><th>Joined</th><th className="num">Orders</th><th className="num">Spent</th></tr></thead>
                  <tbody>
                    {accounts.map((a) => (
                      <tr key={a.email}>
                        <td>{a.name}<div className="adm-muted">{a.email}</div></td>
                        <td><span className={`adm-chip ${a.role === 'admin' ? 's-in_progress' : 's-closed'}`}>{a.role}</span></td>
                        <td>{day(a.created_at)}</td>
                        <td className="num">{a.orders}</td>
                        <td className="num">{rupiah(a.spent)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
            <section className="adm-card flush">
              <div className="adm-card-head pad"><h2>Newsletter</h2><span className="adm-muted">{subscribers.length} subscribers</span></div>
              <div className="adm-scroll tall">
                <table className="adm-table">
                  <tbody>
                    {subscribers.map((s) => <tr key={s.email}><td>{s.email}</td><td className="num adm-muted">{day(s.created_at)}</td></tr>)}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
      </Gate>
    </>
  )
}
