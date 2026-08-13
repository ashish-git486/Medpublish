// A small set of hand-built line icons so the homepage doesn't need an
// extra icon-library dependency. All icons share the same stroke weight
// and rounded joins so they read as one consistent visual system.

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

export function IconPulse(props) {
  return (
    <svg {...base} {...props}>
      <path d="M2.5 12h4l2-6 4 12 2-9 1.5 3h5.5" />
    </svg>
  )
}

export function IconCell(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="9" cy="10" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="9" r="1" fill="currentColor" stroke="none" />
      <circle cx="13" cy="14.5" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function IconBrain(props) {
  return (
    <svg {...base} {...props}>
      <path d="M9 4.5a3 3 0 0 0-3 3v.3A3 3 0 0 0 4.5 10.5a3.2 3.2 0 0 0 1 5.4A3 3 0 0 0 8.5 19.5H9a2 2 0 0 0 2-2v-11a2 2 0 0 0-2-2Z" />
      <path d="M15 4.5a3 3 0 0 1 3 3v.3a3 3 0 0 1 1.5 2.7 3.2 3.2 0 0 1-1 5.4 3 3 0 0 1-3 3.6H15a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2Z" />
    </svg>
  )
}

export function IconGlobe(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.5 2.4 3.8 5.3 3.8 8.5s-1.3 6.1-3.8 8.5c-2.5-2.4-3.8-5.3-3.8-8.5S9.5 5.9 12 3.5Z" />
    </svg>
  )
}

export function IconVirus(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.8 5.8l2.1 2.1M16.1 16.1l2.1 2.1M5.8 18.2l2.1-2.1M16.1 7.9l2.1-2.1" />
    </svg>
  )
}

export function IconCap(props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 4 2.5 8.5 12 13l9.5-4.5L12 4Z" />
      <path d="M6.5 10.8v4.4c0 1.6 2.5 3.3 5.5 3.3s5.5-1.7 5.5-3.3v-4.4" />
      <path d="M21 9v5.5" />
    </svg>
  )
}

export function IconSearch(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20.5 20.5-4.3-4.3" />
    </svg>
  )
}

export function IconUpload(props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 15.5V4.5M8 8.3 12 4.5l4 3.8" />
      <path d="M4.5 15.5v3a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-3" />
    </svg>
  )
}

export function IconUnlock(props) {
  return (
    <svg {...base} {...props}>
      <rect x="4.5" y="11" width="15" height="9" rx="1.8" />
      <path d="M8 11V8a4 4 0 0 1 7.5-1.9" />
    </svg>
  )
}

export function IconUsers(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="9" cy="8.5" r="3" />
      <path d="M3 19.5c0-3 2.7-5 6-5s6 2 6 5" />
      <circle cx="17" cy="9.5" r="2.3" />
      <path d="M15.5 14.6c2.6.3 4.5 2.1 4.5 4.9" />
    </svg>
  )
}

export function IconNode(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function IconPlus(props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

export function IconTrash(props) {
  return (
    <svg {...base} {...props}>
      <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  )
}

export function IconArrowUp(props) {
  return (
    <svg {...base} {...props}>
      <path d="m18 15-6-6-6 6" />
    </svg>
  )
}

export function IconArrowDown(props) {
  return (
    <svg {...base} {...props}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}
