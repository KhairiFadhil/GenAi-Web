import { forwardRef } from 'react'
import { Close } from './Icons.jsx'

export const SIZE_TABLE = [[39, 6, 24.5], [40, 7, 25], [41, 8, 26], [42, 9, 27], [43, 10, 28], [44, 11, 29]]
export const APPAREL_TABLE = [['S', '88–96', '68'], ['M', '96–104', '70'], ['L', '104–112', '72'], ['XL', '112–120', '74']]

const SizeGuide = forwardRef(function SizeGuide(_, ref) {
  return (
    <dialog ref={ref} aria-labelledby="size-guide-title" onClick={(e) => e.target === e.currentTarget && e.currentTarget.close()}>
      <div className="dialog-head">
        <h2 id="size-guide-title">Size guide</h2>
        <button className="icon-btn" onClick={() => ref.current.close()} aria-label="Close size guide"><Close /></button>
      </div>
      <div className="dialog-body">
        <div className="label">Sneakers</div>
        <table>
          <thead><tr><th>EU</th><th>US</th><th>CM</th></tr></thead>
          <tbody>{SIZE_TABLE.map((r) => <tr key={r[0]}>{r.map((c) => <td key={c}>{c}</td>)}</tr>)}</tbody>
        </table>
        <div className="label" style={{ marginTop: 28 }}>Apparel</div>
        <table>
          <thead><tr><th>Size</th><th>Chest (cm)</th><th>Length (cm)</th></tr></thead>
          <tbody>{APPAREL_TABLE.map((r) => <tr key={r[0]}>{r.map((c) => <td key={c}>{c}</td>)}</tr>)}</tbody>
        </table>
        <p className="small">Approximate — varies by brand. Between sizes? Go half a size up for leather sneakers.</p>
      </div>
    </dialog>
  )
})

export default SizeGuide
