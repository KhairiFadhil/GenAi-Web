const icon = (d) => (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    {d}
  </svg>
)

export const Heart = icon(<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" />)
export const Bag = icon(<><path d="M5 8h14l-1 12H6L5 8Z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></>)
export const Menu = icon(<><path d="M4 8h16" /><path d="M4 16h16" /></>)
export const Close = icon(<><path d="M6 6l12 12" /><path d="M18 6L6 18" /></>)
export const Search = icon(<><circle cx="11" cy="11" r="6" /><path d="M20 20l-4.5-4.5" /></>)
export const Check = icon(<path d="M5 12.5l4.5 4.5L19 7" />)
export const Cube = icon(<><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3Z" /><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" /></>)
export const Truck = icon(<><path d="M3 7h11v9H3z" /><path d="M14 10h4l3 3v3h-7" /><circle cx="7" cy="17.5" r="1.6" /><circle cx="17" cy="17.5" r="1.6" /></>)
