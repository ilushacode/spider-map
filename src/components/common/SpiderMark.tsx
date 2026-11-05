export default function SpiderMark({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="spider-mark"
    >
      <g stroke="currentColor" strokeWidth="1.1" strokeLinecap="round">
        <path d="M12 12 5 5" />
        <path d="M12 12 19 5" />
        <path d="M12 12 3.5 12" />
        <path d="M12 12 20.5 12" />
        <path d="M12 12 5 19" />
        <path d="M12 12 19 19" />
        <path d="M12 12 12 3" />
        <path d="M12 12 12 21" />
      </g>
      <circle cx="12" cy="12" r="2.4" fill="currentColor" />
      <circle cx="5" cy="5" r="1.1" fill="currentColor" />
      <circle cx="19" cy="5" r="1.1" fill="currentColor" />
      <circle cx="3.5" cy="12" r="1.1" fill="currentColor" />
      <circle cx="20.5" cy="12" r="1.1" fill="currentColor" />
      <circle cx="5" cy="19" r="1.1" fill="currentColor" />
      <circle cx="19" cy="19" r="1.1" fill="currentColor" />
      <circle cx="12" cy="3" r="1.1" fill="currentColor" />
      <circle cx="12" cy="21" r="1.1" fill="currentColor" />
    </svg>
  )
}
