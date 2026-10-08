import { Gate, PageHead, day, useLoad, when } from './ui.jsx'

export default function Verifications() {
  const state = useLoad('admin/verifications')
  return (
    <>
      <PageHead title="Verifications" sub="ORI ID checks" />
      <Gate state={state}>
        {({ recent, by_product, unknown }) => {
          const max = Math.max(...by_product.map((p) => p.checks), 1)
          return (
            <>
              <section className="adm-card">
                <div className="adm-card-head"><h2>Unknown codes</h2><span className="adm-muted">Last 30 days · possible counterfeits or typos</span></div>
                {unknown.length ? (
                  <div className="adm-scroll">
                    <table className="adm-table">
                      <thead><tr><th>Code</th><th className="num">Checks</th><th>Last seen</th><th /></tr></thead>
                      <tbody>
                        {unknown.map((u) => (
                          <tr key={u.code}>
                            <td className="mono">{u.code}</td>
                            <td className="num">{u.checks}</td>
                            <td>{when(u.last_seen)}</td>
                            <td><span className={`adm-chip ${u.checks > 2 ? 's-cancelled' : 's-pending'}`}>{u.checks > 2 ? '⚠ repeated' : 'not in catalog'}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : <p className="adm-muted">No unknown codes checked in the last 30 days.</p>}
              </section>

              <div className="adm-cols two">
                <section className="adm-card">
                  <div className="adm-card-head"><h2>Most checked</h2><span className="adm-muted">Last 30 days</span></div>
                  <ol className="adm-rank">
                    {by_product.map((p) => (
                      <li key={p.id}>
                        <div className="adm-rank-row"><span>{p.name}</span><b>{p.checks}</b></div>
                        <div className="adm-meter"><span style={{ width: `${(p.checks / max) * 100}%` }} /></div>
                      </li>
                    ))}
                  </ol>
                </section>

                <section className="adm-card">
                  <div className="adm-card-head"><h2>Recent checks</h2><span className="adm-muted">Latest {recent.length}</span></div>
                  <div className="adm-scroll tall">
                    <table className="adm-table">
                      <tbody>
                        {recent.map((e, i) => (
                          <tr key={i}>
                            <td className="mono">{e.code}</td>
                            <td>{e.product_id ? e.name : <span className="adm-chip s-cancelled">unknown</span>}</td>
                            <td className="num adm-muted" title={day(e.created_at)}>{when(e.created_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            </>
          )
        }}
      </Gate>
    </>
  )
}
