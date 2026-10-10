import AvatarPreview from './game/AvatarPreview'
import GameCanvas from './game/GameCanvas'
import GunPreview from './game/GunPreview'
import MapPreview from './game/MapPreview'
import UIRoot from './ui/UIRoot'
import './ui/ui.css'

// Dev viewers: `/?preview=map` (bare map) and `/?preview=avatars` (every player pose), `/?preview=guns` (weapons + attachments).
const PREVIEW = new URLSearchParams(window.location.search).get('preview')

function App() {
  if (PREVIEW === 'map') return <MapPreview />
  if (PREVIEW === 'avatars') return <AvatarPreview />
  if (PREVIEW === 'guns') return <GunPreview />
  return (
    <div className="relative h-screen w-screen overflow-hidden" style={{ background: '#0e1014' }}>
      <GameCanvas />
      <UIRoot />
    </div>
  )
}

export default App
