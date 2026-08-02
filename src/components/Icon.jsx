const paths = {
  command: '<path d="M4 17V7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3Z"/><path d="M8 9h8M8 13h5"/>',
  overview: '<path d="M4 13h6V4H4v9Zm0 7h6v-3H4v3Zm10 0h6V11h-6v9Zm0-13h6V4h-6v3Z"/>',
  data: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v7c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12v7c0 1.7 3.6 3 8 3s8-1.3 8-3v-7"/>',
  insight: '<path d="M4 18V9m5 9V5m5 13v-7m5 7V3"/>',
  cases: '<path d="M8 4h8M9 3v3m6-3v3M5 6h14v14H5z"/><path d="M8 11h3m2 0h3M8 15h3m2 0h3"/>',
  action: '<path d="m5 12 4 4L19 6"/><path d="M21 12a9 9 0 1 1-5.3-8.2"/>',
  report: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7m-7 4h7"/>',
  shield: '<path d="M12 3 4.5 6v5.5c0 4.7 3.2 8 7.5 9.5 4.3-1.5 7.5-4.8 7.5-9.5V6L12 3Z"/><path d="m9 12 2 2 4-4"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  upload: '<path d="M12 16V4m-4 4 4-4 4 4"/><path d="M5 15v5h14v-5"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  alert: '<path d="M12 4 3 20h18L12 4Z"/><path d="M12 9v5m0 3h.01"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  people: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
  spark: '<path d="m12 3 1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3Z"/><path d="m19 16 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16Z"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  filter: '<path d="M4 5h16l-6 7v6l-4 2v-8L4 5Z"/>',
  download: '<path d="M12 4v12m-4-4 4 4 4-4"/><path d="M5 20h14"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  eye: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/>',
  brain: '<path d="M9.5 4A3.5 3.5 0 0 0 6 7.5v.4A3 3 0 0 0 4 13a3 3 0 0 0 2.5 4.9A3.5 3.5 0 0 0 10 21V4h-.5Zm5 0A3.5 3.5 0 0 1 18 7.5v.4a3 3 0 0 1 2 5.1 3 3 0 0 1-2.5 4.9A3.5 3.5 0 0 1 14 21V4h.5Z"/><path d="M7 9h3m4 6h3M7 16h3m4-7h3"/>',
  retry: '<path d="M20 7v5h-5"/><path d="M19 12a7 7 0 1 0-2 5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
}

export default function Icon({ name, size = 18, strokeWidth = 1.8, className = '' }) {
  return (
    <svg
      className={`icon ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: paths[name] || paths.info }}
    />
  )
}
