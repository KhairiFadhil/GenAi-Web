// Shipment tracking for the customer's order list. Built from the order's fulfilment data in the database:
// the admin marks orders paid / shipped (courier + waybill) / delivered and posts tracking updates, each stored
// as an order event. A courier API integration would add its scan events to the same log, nothing here changes.

const DAY = 864e5
const ETA_DAYS = 3 // standard shipping, 2-4 business days

/**
 * @returns {{ stage: 'pending'|'packing'|'in_transit'|'delivered'|'cancelled', headline: string,
 *   courier?: string, waybill?: string, eta?: number, deliveredAt?: number,
 *   events: { at: number, text: string, place?: string }[] }}  events newest first
 */
export function trackOrder(order) {
  const events = [
    { at: Date.parse(order.created_at), text: 'Order placed' },
    ...(order.events ?? []).map((e) => ({ at: Date.parse(e.at), text: e.text, place: e.place ?? undefined })),
  ].sort((a, b) => b.at - a.at)
  const latest = events[0]
  const base = { events, courier: order.courier ?? undefined, waybill: order.waybill ?? undefined }

  switch (order.status) {
    case 'pending': return { ...base, stage: 'pending', headline: 'Waiting for payment' }
    case 'paid': return { ...base, stage: 'packing', headline: 'Seller is packing your order' }
    case 'cancelled': return { ...base, stage: 'cancelled', headline: 'Order cancelled' }
    case 'delivered': return { ...base, stage: 'delivered', headline: 'Delivered to your address', deliveredAt: Date.parse(order.delivered_at ?? latest.at) }
    default: return {
      ...base,
      stage: 'in_transit',
      headline: latest.text + (latest.place ? `, ${latest.place}` : ''),
      eta: Date.parse(order.shipped_at ?? order.created_at) + ETA_DAYS * DAY,
    }
  }
}

export const STAGES = [
  ['all', 'All'],
  ['pending', 'To pay'],
  ['packing', 'Packing'],
  ['in_transit', 'Shipped'],
  ['delivered', 'Completed'],
  ['cancelled', 'Cancelled'],
]
