/**
 * Decorative network of learners: tan dots joined by thin lines, soft avatar
 * icons and a glowing AI-mentor core. Purely visual (aria-hidden).
 */

const NODES = [
  { x: 120, y: 160 },
  { x: 420, y: 90 },
  { x: 700, y: 200 },
  { x: 90, y: 520 },
  { x: 740, y: 560 },
  { x: 300, y: 820 },
  { x: 560, y: 780 },
]

// Avatars sit on the graph; delay staggers the floating motion.
const AVATARS = [
  { x: 190, y: 300, delay: '0s' },
  { x: 590, y: 290, delay: '-2s' },
  { x: 290, y: 600, delay: '-4s' },
  { x: 650, y: 660, delay: '-1s' },
]

const LINES: Array<[number, number, number, number]> = [
  [120, 160, 190, 300],
  [120, 160, 420, 90],
  [420, 90, 590, 290],
  [420, 90, 400, 450],
  [700, 200, 590, 290],
  [190, 300, 400, 450],
  [590, 290, 400, 450],
  [400, 450, 290, 600],
  [400, 450, 650, 660],
  [190, 300, 90, 520],
  [90, 520, 290, 600],
  [290, 600, 300, 820],
  [650, 660, 560, 780],
  [650, 660, 740, 560],
  [590, 290, 740, 560],
  [300, 820, 560, 780],
]

function Avatar({ x, y, delay }: { x: number; y: number; delay: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <g className="sf-float" style={{ animationDelay: delay }}>
        <circle r="46" cy="-22" fill="none" stroke="#D4B08C" strokeOpacity="0.28" />
        <circle cx="0" cy="-30" r="30" fill="url(#sf-avatar)" />
        <path d="M-56 56 C-56 14 -34 -4 0 -4 C34 -4 56 14 56 56 Z" fill="url(#sf-avatar)" />
      </g>
    </g>
  )
}

export function NetworkIllustration() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 800 900"
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 size-full"
    >
      <defs>
        <linearGradient id="sf-avatar" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#E3C6A4" />
          <stop offset="1" stopColor="#B98F66" />
        </linearGradient>
        <radialGradient id="sf-glow">
          <stop offset="0" stopColor="#D4B08C" stopOpacity="0.55" />
          <stop offset="1" stopColor="#D4B08C" stopOpacity="0" />
        </radialGradient>
      </defs>

      <g stroke="#D4B08C" strokeOpacity="0.38" strokeWidth="1.5">
        {LINES.map(([x1, y1, x2, y2]) => (
          <line key={`${x1}-${y1}-${x2}-${y2}`} x1={x1} y1={y1} x2={x2} y2={y2} />
        ))}
      </g>

      {NODES.map((n) => (
        <circle key={`${n.x}-${n.y}`} cx={n.x} cy={n.y} r="7" fill="#D4B08C" fillOpacity="0.9" />
      ))}
      {[
        [60, 260],
        [520, 140],
        [770, 380],
        [180, 700],
        [480, 640],
      ].map(([cx, cy]) => (
        <circle key={`d-${cx}-${cy}`} cx={cx} cy={cy} r="3" fill="#D4B08C" fillOpacity="0.55" />
      ))}

      {AVATARS.map((a) => (
        <Avatar key={`${a.x}-${a.y}`} {...a} />
      ))}

      {/* Glowing AI mentor core */}
      <g transform="translate(400 450)">
        <circle r="140" fill="url(#sf-glow)" className="sf-pulse" />
        <circle r="58" fill="#D4B08C" fillOpacity="0.22" />
        <rect x="-38" y="-38" width="76" height="76" rx="22" fill="none" stroke="#F3E3CC" strokeOpacity="0.9" strokeWidth="3" />
        <circle cx="-14" cy="-8" r="5" fill="#F3E3CC" />
        <circle cx="14" cy="-8" r="5" fill="#F3E3CC" />
        <path d="M-16 12 Q0 26 16 12" fill="none" stroke="#F3E3CC" strokeWidth="3.5" strokeLinecap="round" />
        <g stroke="#F3E3CC" strokeOpacity="0.7" strokeWidth="2.5" strokeLinecap="round">
          <line x1="0" y1="-58" x2="0" y2="-46" />
          <line x1="0" y1="58" x2="0" y2="46" />
          <line x1="-58" y1="0" x2="-46" y2="0" />
          <line x1="58" y1="0" x2="46" y2="0" />
        </g>
      </g>
    </svg>
  )
}
