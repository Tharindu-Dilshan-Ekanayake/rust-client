import { rankInfo, RANKS } from '../shared/progression.js'
import { useGameStore } from '../store/gameStore.js'
import { RankInsignia } from './RankInsignia.jsx'

/** Ranks and XP in the UI: menu card, HUD popups, promotion banner, match summary. */

const WHY = {
  kill: 'Kill',
  headshot: 'Headshot',
  knife: 'Knife kill',
  longshot: 'Longshot',
  revenge: 'Revenge',
  time: 'Time played',
  match: 'Match complete',
  win: 'Victory',
  mvp: 'MVP',
}

const fmt = (n) => Math.round(n).toLocaleString('en-US')

function Progress({ info, height = 6 }) {
  return (
    <div className="dl-xp-track" style={{ height }}>
      <div style={{ width: `${(info.progress * 100).toFixed(1)}%` }} />
    </div>
  )
}

/** Main menu: insignia, rank and XP to the next rank. */
export function RankCard() {
  const xp = useGameStore((s) => s.xp)
  const info = rankInfo(xp)
  return (
    <div className="dl-panel dl-rankcard dl-slide-up">
      <RankInsignia rank={info.number} size={58} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="dl-label">Rank {info.number}</div>
        <div className="dl-h" style={{ fontSize: 22, lineHeight: 1.1 }}>
          {info.rank.name}
        </div>
        <Progress info={info} />
        <div className="dl-muted" style={{ fontSize: 11, display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 4 }}>
          <span>{fmt(xp)} XP</span>
          <span>{info.next ? `${fmt(info.next.xp - xp)} to ${info.next.short}` : 'Top rank'}</span>
        </div>
      </div>
    </div>
  )
}

/** "+100 KILL" popups under the crosshair. */
export function XpFeed() {
  const feed = useGameStore((s) => s.xpFeed)
  if (!feed.length) return null
  const total = feed.reduce((a, x) => a + x.n, 0)
  return (
    <div className="dl-xpfeed">
      <div className="total" key={feed[feed.length - 1].id}>
        +{total}
      </div>
      {feed
        .slice()
        .reverse()
        .map((x) => (
          <div className="line" key={x.id}>
            {WHY[x.why] ?? x.why} <b>+{x.n}</b>
          </div>
        ))}
    </div>
  )
}

/** Thin rank-progress strip along the bottom of the HUD. */
export function XpBar() {
  const xp = useGameStore((s) => s.xp)
  const info = rankInfo(xp)
  return (
    <div className="dl-xpbar">
      <RankInsignia rank={info.number} size={26} />
      <span className="dl-label">{info.rank.short}</span>
      <Progress info={info} height={7} />
      <span className="dl-label">{info.next ? info.next.short : 'MAX'}</span>
      <span className="xp">{info.next ? `${fmt(xp - info.rank.xp)} / ${fmt(info.next.xp - info.rank.xp)} XP` : `${fmt(xp)} XP`}</span>
    </div>
  )
}

/** Rank-up banner. */
export function PromotionBanner() {
  const promo = useGameStore((s) => s.promotion)
  if (!promo) return null
  const rank = RANKS[promo.rank - 1]
  return (
    <div className="dl-promotion" key={promo.id}>
      <RankInsignia rank={promo.rank} size={70} />
      <div>
        <div className="dl-label" style={{ color: 'var(--accent)' }}>
          Promoted
        </div>
        <div className="dl-h" style={{ fontSize: 30, lineHeight: 1.05 }}>
          {rank.name}
        </div>
        <div className="dl-label">Rank {promo.rank}</div>
      </div>
    </div>
  )
}

/** End-of-match XP breakdown and where it leaves the player's rank. */
export function MatchXpSummary() {
  const matchXp = useGameStore((s) => s.matchXp)
  const xp = useGameStore((s) => s.xp)
  const info = rankInfo(xp)
  const lines = Object.entries(matchXp.by).sort((a, b) => b[1] - a[1])
  return (
    <div className="dl-panel dl-xp-summary dl-slide-up">
      <RankInsignia rank={info.number} size={46} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
          <span className="dl-h" style={{ fontSize: 18 }}>
            {info.rank.name}
          </span>
          <span className="dl-h" style={{ fontSize: 20, color: 'var(--accent)' }}>
            +{fmt(matchXp.total)} XP
          </span>
        </div>
        <Progress info={info} />
        <div className="dl-xp-lines">
          {lines.length ? (
            lines.map(([why, n]) => (
              <span key={why}>
                {WHY[why] ?? why} <b>+{fmt(n)}</b>
              </span>
            ))
          ) : (
            <span>No XP this match</span>
          )}
          {info.next && <span className="dl-muted">{fmt(info.next.xp - xp)} XP to {info.next.name}</span>}
        </div>
      </div>
    </div>
  )
}
