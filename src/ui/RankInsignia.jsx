import { RANKS } from '../shared/progression.js'

/**
 * Rank insignia drawn as SVG, army style: chevrons and rockers for the enlisted
 * ranks, bars, oak leaves, an eagle and stars for officers.
 */

const GOLD = '#d9b04f'
const SILVER = '#d4d8dc'
const EDGE = 'rgba(0,0,0,0.55)'

const chevron = (y) => `M2 ${y + 6}L12 ${y}L22 ${y + 6}V${y + 9}L12 ${y + 3}L2 ${y + 9}Z`
const rocker = (y) => `M2 ${y}Q12 ${y + 5} 22 ${y}V${y + 2.6}Q12 ${y + 7.6} 2 ${y + 2.6}Z`

function star(cx, cy, r) {
  let d = ''
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    const rr = i % 2 ? r * 0.42 : r
    d += `${i ? 'L' : 'M'}${(cx + Math.cos(a) * rr).toFixed(2)} ${(cy + Math.sin(a) * rr).toFixed(2)}`
  }
  return `${d}Z`
}

/** [chevrons, rockers, centre symbol] for the enlisted ranks (1-based rank number). */
const ENLISTED = {
  1: [1, 0, null],
  2: [1, 1, null],
  3: [2, 0, null],
  4: [3, 0, null],
  5: [3, 1, null],
  6: [3, 2, null],
  7: [3, 3, null],
  8: [3, 3, 'diamond'],
  9: [3, 3, 'star'],
}

function shapes(rank) {
  const e = ENLISTED[rank]
  if (e) {
    const [chevrons, rockers, symbol] = e
    // Laid out from y=0, then centred in the 36-unit-tall box.
    const paths = []
    for (let i = 0; i < chevrons; i++) paths.push(chevron(i * 4.2))
    const lastChevron = (chevrons - 1) * 4.2
    const rockerTop = lastChevron + 9.8
    for (let j = 0; j < rockers; j++) paths.push(rocker(rockerTop + j * 3.6))
    // The diamond / star sits in the V between the chevrons and the rockers.
    const cy = (lastChevron + 3 + rockerTop + 5) / 2
    if (symbol === 'diamond') paths.push(`M12 ${cy - 3.6}L15 ${cy}L12 ${cy + 3.6}L9 ${cy}Z`)
    if (symbol === 'star') paths.push(star(12, cy, 3.8))
    const height = rockers ? rockerTop + (rockers - 1) * 3.6 + 7.6 : lastChevron + 9
    return { color: GOLD, paths, shift: (36 - height) / 2 }
  }
  switch (rank) {
    case 10:
      return { color: GOLD, paths: ['M8 6h8v24H8z'] }
    case 11:
      return { color: SILVER, paths: ['M8 6h8v24H8z'] }
    case 12:
      return { color: SILVER, paths: ['M3 6h7v24H3z', 'M14 6h7v24h-7z'] }
    case 13:
    case 14: {
      // Oak leaf: lobed leaf with a stem.
      const leaf =
        'M12 4C15 7 19 7 18 11C21 12 21 16 18 17C20 20 18 23 15 22C15 26 13 28 12 28C11 28 9 26 9 22C6 23 4 20 6 17C3 16 3 12 6 11C5 7 9 7 12 4Z'
      return { color: rank === 13 ? GOLD : SILVER, paths: [leaf, 'M11.3 26h1.4v6h-1.4z'] }
    }
    case 15:
      // Spread eagle: wings, body and head.
      return {
        color: SILVER,
        paths: ['M1 10L7 15L10 11L12 13L14 11L17 15L23 10L20 21L15 24L12 30L9 24L4 21Z', 'M10.5 6h3l1 3l-2.5 2l-2.5-2z'],
      }
    default:
      return { color: SILVER, paths: [star(7, 11, 5), star(17, 11, 5), star(7, 24, 5), star(17, 24, 5)] }
  }
}

export function RankInsignia({ rank = 1, size = 28, style }) {
  const { color, paths, shift = 0 } = shapes(Math.max(1, Math.min(RANKS.length, rank)))
  return (
    <svg viewBox="0 0 24 36" height={size} style={{ display: 'block', flex: 'none', ...style }} aria-label={RANKS[rank - 1]?.name}>
      <g transform={`translate(0 ${shift})`}>
        {paths.map((d, i) => (
          <path key={i} d={d} fill={color} stroke={EDGE} strokeWidth={0.8} strokeLinejoin="round" />
        ))}
      </g>
    </svg>
  )
}

export default RankInsignia
