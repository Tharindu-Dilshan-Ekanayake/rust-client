import { runtime } from '../game/runtime.js'
import { sitesOf } from '../game/snd.js'
import { SND } from '../shared/constants.js'

/** Search & Destroy on the minimap (ui/HUD.jsx): the sites, and the bomb when your side should know where it is. */
export function drawSndMinimap(ctx, tx, scale, map, team) {
  const s = runtime.snd
  if (!s.phase) return
  const r = Math.max(10, SND.siteRadius * scale)
  ctx.save()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `700 ${Math.round(r * 1.15)}px Rajdhani, Oswald, sans-serif`
  for (const site of sitesOf(map)) {
    const x = tx(site.p[0])
    const y = tx(site.p[2])
    const hot = s.phase === 'planted' && s.site === site.id
    ctx.fillStyle = hot ? 'rgba(229, 72, 77, 0.35)' : 'rgba(242, 163, 58, 0.22)'
    ctx.strokeStyle = hot ? '#E5484D' : '#F2A33A'
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#fff'
    ctx.fillText(site.id, x, y + 1)
  }
  const showBomb = s.bombState === 'planted' || (s.bombState === 'dropped' && team === s.attackers)
  if (showBomb) {
    const pulse = s.bombState === 'planted' ? 0.55 + 0.45 * Math.sin(performance.now() / 120) : 1
    ctx.globalAlpha = pulse
    ctx.fillStyle = s.bombState === 'planted' ? '#E5484D' : '#F2A33A'
    ctx.strokeStyle = '#0e1014'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.rect(tx(s.x) - 6, tx(s.z) - 5, 12, 10)
    ctx.fill()
    ctx.stroke()
  }
  ctx.restore()
}
