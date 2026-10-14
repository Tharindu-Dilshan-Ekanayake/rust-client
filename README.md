# Modern Guns — client

**Modern Guns** is a browser FPS built with React Three Fiber + Rapier, played
with your **Bloxity** avatar. Up to 8 players per lobby, Team Deathmatch,
Free-for-all or [Search & Destroy](#search--destroy), on six maps (picked on
the *Find a match* screen, see [Maps](#maps)).

*Atomic Acres* (84 × 84 m, the default) is a 1950s test-site suburb. A school
bus and a moving truck stand in the cul-de-sac at its centre; you can walk
through the bus (doors open at both ends, every window down) and up the truck's
ramp into its trailer full of boxes. Across the circle face the two family
houses — the yellow one (stone chimney, carport) to the west and the teal-green
one (white upper storey with shutters, garage) to the east — two storeys each,
stairs inside, upstairs windows over the cul-de-sac, and a door upstairs out
onto the carport or garage roof. Behind them are the fenced backyards where the
teams spawn. Round about: a modern orange house and a park with the town sign
to the north, a water tower with a clock in the north-west (one ladder up to its
deck), a cottage and an empty pool with its pool house to the south, and the
road out, closed by a barricade and an army jeep. Mannequins stand about the
place. A chain-link fence closes the town in; past it, desert and mountains.

*Dustline Pumpstation* is a 60 × 60 m oil yard in a hazy desert, styled after
MW's Rust. In the middle stands the refinery: a corrugated pump hall with an
open bay, a deck over them reached by a conveyor ramp, a clad process tower with
the company plate and a burning flare stack, and a raised tank platform. The
derrick tower (one exposed ladder to its lookout deck) stands in the north-east
corner by the pipeline, which runs along the north wall with a lane underneath; its
torn west end has dropped into the sand and makes a ramp up onto the pipe.
The tank yard (stairs and a catwalk over the tank tops) holds the opposite,
south-west corner, so both high points are neutral corners the same distance
from each spawn. Round them: tall concrete T-walls with rusty mesh and razor wire, container stacks with graffiti and
deck tanks, shelled two-storey block buildings with sand banked against them,
and burnt-out vehicles (a fuel tanker, an APC, trucks) still burning, with black
smoke leaning downwind. The refinery deck can be reached three ways: the
conveyor (west), the south stairs and the bay ladder (east). A dust storm blows
through the whole match: debris whipping past, sand sheets low over the ground,
and gusts that close the haze in. Out past the wall: a rail spur, storage tanks
and hills.

Classes pick a primary (VX-7 AR, VK-9 Vandal SMG, Breacher 12 pump shotgun,
Longhaul .50 sniper, Bulldog LMG), a secondary (Kestrel P9, Viper .45 revolver,
Hornet machine pistol or the Warhead RL rocket launcher) and a tactical, and each
gun takes attachments: optics (red dot, holo), muzzle (suppressor, compensator)
and extended mags. Aiming lines up whatever optic is fitted with the centre of
the screen; suppressed shots are quiet and never show on enemy minimaps.

## Maps

Each map is data in `shared/` (`map.js` for Dustline, `mapAcres.js` for
Atomic Acres, `mapPalmwood.js` for Palmwood, `mapHollow.js` for Hollow Creek,
`mapQuarter.js` for Old Quarter, `mapBramble.js` for Bramblewood, helpers in
`mapKit.js`), listed in
`shared/maps.js`: its colliders, ladders, spawns, resupply crates, bot
navigation hints and bounds. The client draws the map on screen
(`world/MapScene.jsx` → `world/DustlineMap.jsx`, `world/acres/`,
`world/palmwood/`, `world/hollow/`, `world/quarter/` or `world/bramble/`) with that map's sky and light
(`game/environment.js`) and sound (`game/ambience.js`); the minimap, ladders,
effects and menu camera all follow the active map.

- **Bramblewood** (104 × 104 m, the newest and the biggest): an abandoned
  farm town the woods have taken back, made for long sightlines. North-east, a
  big field of old furrows and round hay bales with a tractor left in it, the
  water tower beside it (one ladder up to its deck, the best view of the field)
  and the barn on its corner (a hayloft up stairs inside its east wall, its
  north window over the field). A dried-up creek cuts right across the middle:
  a ditch 10 m wide and 1.5 m deep, its bed cracked mud with puddles here and
  there, reeds, stones and fallen logs; drop in anywhere and use it as a
  trench. The farm track crosses it on a concrete bridge and the path from the
  meadow on a covered boardwalk, and you can crouch under both (not stand).
  West, Alpha's side, the brick farmhouse; in the middle a roofless ruin and a
  burnt-out tank still burning on the track; east, Bravo's side, the barn.
  Along the dirt road to the south, a row of houses, a tin garage and their
  backyards. Ivy on the walls and poles, tall grass, ferns and bushes in every
  corner, ~90 trees. No team spawn can see the other's.
  - The ground is a triangle mesh (`brambleGround()`, the `mesh` collider
    shape in `mapKit.js`) that the physics and the renderer share, so players,
    bullets, grenades and bots all know the ditch. Bots' ground links may
    climb its banks (`nav.climb`), so they cross where they like.
  - The houses and the barn are Atomic Acres' description, the sheds Palmwood's.
  - Every leaf (trees, bushes, ferns, grass, ivy) is a card in one atlas, so
    they are all one material: crossed cards lit as a canopy from both sides
    (two-sided cards would otherwise light their backs as if they faced the
    ground), fading out as they turn edge-on.
- **Old Quarter** (80 × 80 m): sun-baked backstreets round a
  building site. In the middle stands the Skeleton, an unfinished three-level
  concrete frame: block walls going up on the ground floor, scaffolding on its
  south face, stud frames and rebar on the open top; concrete stairs up its
  east side (to the first floor, then on up to the top) and a ladder up its
  west face. Round it the bulldozer, sand and gravel piles, pallets of blocks,
  a cement mixer and the site container. North over the alley, the apartments:
  balconies with square-pattern iron railings and a stairwell up to the roof;
  north-west the teahouse, its roof reached by stairs in its courtyard;
  north-east the workshop, a ladder up to its roof. West, Alpha's side: the
  west house and tin shacks; east, Bravo's: the east block, stairs up its
  outside to the first floor and the roof, and the pink house. Along Market
  Street to the south the market hall, the courtyard house round its fountain
  and two little houses by a car park. Power lines and cables everywhere,
  palms in the yards, dry grass in the corners; no team spawn can see the
  other's, and every spawn faces an open view.
  - A clear, hot afternoon with nothing laid over the picture: no haze, dust,
    vignette or grain (its colour grade is neutral).
  - Its masonry buildings (`BLOCKS`) are any number of storeys from one
    description: floors with their openings, slabs with stair holes, flat
    roofs with parapets (walkable where stairs reach them), solid concrete
    flights, landings, banisters and balconies; the shacks reuse Palmwood's.

- **Hollow Creek** (80 × 80 m): a small town on Halloween night,
  under a full moon. A witch statue with a carved pumpkin for a head stirs a
  glowing cauldron on the roundabout in the middle; north of it the stone
  church (doors front, back and side; pews inside) with its bell tower and the
  graveyard behind iron railings, headstones and a crypt. South, a creek runs
  across the town under a footbridge and the lanes' culverts, past the red barn
  (a hayloft up the stairs inside its east wall; a hay pile burning by its
  door) and the old watchtower burning at the top (a ladder up to its deck).
  Alpha spawns behind the west house and the west cottage, Bravo behind the
  east ones; the two big houses are Atomic Acres' (upstairs, carport and garage
  roofs), repainted. Pumpkins, lanterns, string lights, scarecrows, hay, dead
  trees, mist and bats; the garden sheds have ammo crates. No team spawn can
  see the other's, and every spawn faces an open view, not a wall.
  - Night without lights: the lamps, windows, candles, carved faces, the
    cauldron and the fires are emissive (over-bright, tone-mapped into a glow),
    with one instanced draw of soft halos round them, additive pools of light
    on the ground, and lit interiors that glow on their own. The sky has stars,
    thin moonlit cloud and the moon (`night` in the sky shader).
  - Sound: wind in the pines and crickets under everything, the church bell
    tolling from its tower now and then, and owls, crows and far-off wolves out
    in the woods, each from its own direction (see [Sound](#sound)).

- **Palmwood** (76 × 76 m): a tropical plywood shanty town. A rutted
  dirt loop runs round the Frame, an unfinished two-storey block whose open top
  floor (safety mesh on the bays, no roof yet) is reached by stairs up its east
  and west sides, and a deck under camo netting. Round the loop: the long house
  (north, Alpha's side), the warehouse and its veranda (east), the market stalls
  and the bunkhouse (south, Bravo's side), the cookhouse (west), tarp and tin
  shacks, two lookout towers, banana groves and coconut palms. No team spawn
  can see the other's (checked eye to eye).

- The map picked in *Find a match* (or on the main menu's map card) is saved
  and shown behind the menus. Quick play only matches rooms on that map; a
  private room opens on it; joining by key puts you on the room's map, whatever
  you had picked. Both pickers show three maps and scroll through the rest
  (wheel, swipe or arrows) under a count of how many there are, so more maps
  never crowd the screen; the chosen one is always scrolled into view.
- Atomic Acres houses (`HOUSES` in `mapAcres.js`) and Palmwood's buildings
  (`BUILDINGS` in `mapPalmwood.js`) are each built from one description: the
  same wall pieces make the colliders and the art, so every door, window,
  stairwell and roof lines up. Hollow Creek's houses, church, barn, cottages
  and sheds use Atomic Acres' description (and its `House`, with a `look`
  for siding, stone, lit rooms and glowing curtains).
- Names and signage are original (no other game's trademarks); Atomic Acres'
  layout follows the classic suburban cul-de-sac.

## Search & Destroy

One life a round: the attackers plant the bomb on site **A** or **B**, the
defenders stop them or defuse it, first side to 4 rounds, sides swap every 3.
Each round the bomb waits on the ground in front of the attackers' spawn
("Grab the bomb"): the first one to it when the round goes live carries it, and
the rest of the team escorts them.
The rules run on the server (`game/searchDestroy.js` there, numbers in `SND`
in `shared/constants.js`, sites in each map's `snd`); `game/snd.js` mirrors
just enough to show prompts and lock movement on time.

- **Plant / defuse**: hold **F** (on a phone, the PLANT / DEFUSE button that
  appears left of the fire cluster): inside a site's ring carrying the bomb, or
  within 1.8 m of a planted bomb as a defender. You can't move or shoot while
  holding it; a bar under the crosshair (and a ring round the touch button) fills
  as the server counts. Each round starts with a 5 s freeze: look around, no moving.
- **HUD** (`ui/SndHud.jsx`): rounds won either side of the clock, a pip per
  player still standing and who attacks (ATK) or defends (DEF); once planted the
  clock becomes the bomb's countdown. "You have the bomb" / "Bomb dropped" under
  it. A / B and bomb markers in the world, pinned to the screen edge when off
  screen and dimmed while you aim. Round banners under the bar: the freeze
  countdown with your side (and match point), GO, then round won / lost, why,
  and the score. Sites and the bomb on the minimap (`ui/sndMinimap.js`).
- **In the world** (`game/fx/SndObjects.jsx`): each site's ring and stencilled
  letter on the ground, and the bomb: blinking orange when dropped, red and
  beeping faster as it runs down once planted, green when defused.
- **Out of the round**: the camera stays on your body a moment, then goes over
  a living teammate's shoulder (click / right-click, ← → or the on-screen arrows
  to switch). Deploying mid-round you watch until the next one.
- Network: `syncSnd` copies the round and bomb into `runtime.snd` every patch,
  `onSnd` turns the server's `snd` events into banners, notices and sounds.

## Ranks

Every gun is open to everyone from the start. Kills, headshots, knife kills,
long shots, revenge, time played and finishing / winning matches earn XP
(`+100 KILL` pops up by the crosshair, with a rank strip along the bottom of
the HUD). XP climbs the army ranks, Private → Sergeant → … → Captain → General
(16 in all), with a promotion banner and insignia on the menu, scoreboards and
end screen. XP lives in this browser (`localStorage`), see
`shared/progression.js`.

## Ladders

The derrick tower, both container stacks with deck tanks and the refinery
(ground → deck → tank platform → process tower roof) have ladders. Walk into
one looking at it and hold W to climb; at the top you step off onto the deck. To get down, walk off the top onto the ladder (W goes down while you face
away from it, S while you face it), or press Space to jump off. Your hands work
hand over hand up the rungs, and others see you face the ladder and climb it.

```bash
npm install
npm run dev        # syncs ../rust-server/src/shared, then starts Vite
```

The game server (`../rust-server`) must be running. Locally the client connects
to `VITE_SERVER_URL`, or `http(s)://<page host>:3000` when unset, so LAN play
works out of the box. See `.env.example`.

## Hosting (Bloxity Legion)

Game id `modern-guns`. Pushing to `dev` or `main` runs
`.github/workflows/deploy.yml`: it builds with `VITE_USE_MATCHMAKER=1`, zips
`dist` and uploads it to Bloxity's static hosting:

| Branch | Frontend | Talks to |
| --- | --- | --- |
| `dev` | https://modern-guns.dev.play.bloxity.io | the dev backend |
| `main` | https://modern-guns.play.bloxity.io | prod |

The repo needs one Actions secret, `LEGION_DEPLOY_TOKEN` (My Games → eye icon);
never put the token in the code or `.env`.

Hosted, the client never opens its game socket to a fixed server. On every join
`net/endpoint.js` asks the matchmaker for a seat
(`Legion.SDK.net.resolveEndpoint('modern-guns')`; the SDK is loaded by a script
tag in `index.html`, not bundled) and builds a **new** Colyseus `Client` from
the endpoint it returns. A failed resolve or join is retried with backoff for up
to a minute (a cold start takes a few seconds; the screen says *Starting a server
for you…*). When a deploy replaces a server, the old one finishes its match and
closes with code 4100 (`SERVER_MOVING_CODE`); public players are then moved to
a fresh server automatically (*Server update — moving you to a new server…*).
A private room's key dies with its server, so those players get a message
instead. Friends who want the same private room should party up on Bloxity so
the matchmaker seats them on the same server.

## Phones and tablets

The game plays on phones and tablets, held sideways (upright, it asks you to
turn the phone). Pressing Play goes full screen and locks landscape where the
browser allows it (inside the Bloxity portal, the portal goes full screen).

- **UI scale** (`ui/uiScale.js`): the UI is laid out for 1280 x 720. A smaller
  screen gets the same layout scaled down to fit (down to 0.5x on a phone), so
  the game view keeps most of the screen and nothing overlaps. The UI root is a
  size container, so its CSS uses `cqw` / `cqh` and `@container` queries
  rather than the viewport.
- **Touch controls** (`ui/TouchControls.jsx`), while you play. See-through
  dark-glass buttons with a thin ring and an icon (no labels), Fire in a
  glowing gold ring, so they hide as little of the game as possible. **Button
  opacity** (Settings, 25-100%, 70% by default) sets how solid they are; the
  settings page lists every button with its icon. No backdrop blur: it smeared
  the game behind the buttons and cost a phone an extra pass.
  - Left thumb: the stick rests bottom-left (dimmed, an arrow at each point)
    and jumps to wherever you touch on that side. Push it all the way up to sprint.
  - Right side: drag to look. Holding Fire also looks.
  - Buttons: Fire (plus a second one on the left), Aim (tap on / off), Jump,
    Crouch (tap) / prone (hold) / slide (while sprinting), Reload, Swap, Frag
    (hold to cook), Tactical, Knife. In Search & Destroy a bigger PLANT /
    DEFUSE button (hold) appears left of them while you can use it.
  - Up top: menu and scoreboard.
  - The HUD moves out of their way: health under the minimap, ammo under the
    kill feed, no XP strip.
- They feed the same input state as the keyboard and mouse (`game/player/input.js`:
  "Touch:*" binds, `input.move`, touch "lock" in place of pointer lock).
  `?touch` turns touch mode on for testing on a desktop.

## Controls

| Key | Action |
| --- | --- |
| WASD / mouse | Move / look |
| Left / right click | Fire / aim down sights |
| Space, Shift | Jump (stands you up from crouch/prone), sprint (hold breath when scoped) |
| C | Tap: crouch / stand. Hold: prone. While sprinting: slide (jump out of it to keep the speed) |
| Ctrl | Prone / stand (mid-match the browser asks before Ctrl+W closes the tab) |
| R | Reload |
| 1 / 2 / 3, mouse wheel | Primary / secondary / knife |
| V | Quick knife: whips the knife out for a slash with any weapon (lunges at close targets) |
| G (hold) | Cook + throw frag |
| Q | Flashbang or smoke |
| F (hold) | Plant / defuse the bomb (Search & Destroy) |
| B | Change class (applies next spawn) |
| Tab / Esc | Scoreboard / menu (the match keeps running) |

## Your Bloxity avatar

Other players see your Bloxity avatar: body parts, the skin texture with your
shirt, pants and face drawn on (`skinTextureUrl`, the same URL the SDK's
`getSkinTextureUrl()` builds), hat and back items. In first person the hands on
the gun, and on ladders, are your own avatar's arms (`game/player/bloxArms.js`):
the arm part you wear in your skin texture, so the sleeves match your shirt.
Hand accessories (gloves, watches...) are not shown in this game. Both update when you change
your avatar in the portal. There's no login or logout in the game: it opens
signed in to your Bloxity account, or as a Bloxity guest.

## Private matches

Play → *Create a room* picks TDM, Search & Destroy or FFA, the size (1v1 to 4v4 / 2 to 8 players)
and whether bots fill empty slots. The lobby, deploy screen and pause menu show
the 6-character room key with a copy button; friends enter it under *Join with
a key* (six boxes; pasting works). Private rooms never take players from public
matchmaking, and start in a **warm-up**: everyone can spawn and play, but the
clock and scores wait until the host presses *Start match* (deploy screen or
Esc menu). If the host leaves, the longest-standing player takes over.

## Sound

No audio files. `audio/bank.js` renders every sound sample-by-sample when audio
starts (layered gunshots — crack, muzzle blast, boom, action, early reflections —
per-gun reload foley, knife, footsteps on sand/metal, explosions, distant
artillery), with a few variations each. The guns are mixed Call of Duty style:
your own shot is wide stereo with a sub kick and the bolt's clack-clack, and a
ring-out plays when you let go of the trigger; other players' guns crossfade
from their close shot to a distant pop-and-roll between 20 and 38 m; rounds
passing within ~3 m of your head crack past you; hits, headshots ("dink"),
kills and headshot kills have their own dry markers; aiming in rattles your
gear, and the last quarter of a mag pings hollow under each shot. Everything shares a generated outdoor
reverb, and distant sounds arrive late (speed of sound) and muffled.
`audio/music.js` renders a 48 s war score loop offline; it plays full in the
menus and tucked low under a match, where the map's ambience takes over
(`game/ambience.js`): distant artillery and bursts beyond the walls, or on
Hollow Creek a Halloween night, rendered into the same bank: a looped bed of
wind in the pines and crickets (its gusts repeat with the loop, so the seam
never shows), a church bell (a bell's partials, hum to upper octave, each
ringing its own length and beating slowly) tolling three times from the
belfry a few seconds into a match and every minute or two after, and owls,
crows and wolves calling from random bearings round the town, positional like
any other sound. Settings has separate master and music volume.

## Netcode and look

Players stream moves at 30 Hz with their own clock; the server stamps each
position (`mt`) on its timeline with the upload jitter removed, and clients draw
remote players ~90 ms behind on that timeline (`net/network.js`), extrapolating
briefly through late packets. Above Low quality the frame goes through an HDR
war-film colour grade (`game/ColorGrade.js`: ACES, bleach-bypass contrast,
pulled-back saturation, teal/amber split toning, vignette), and smoke columns
rise from the burnt-out APC and beyond the walls.

## Layout

```
src/
  shared/          copied from the server — weapons, maps, hitboxes, constants
  store/           zustand: screens, classes (localStorage), settings, HUD
  net/network.js   Colyseus connection, snapshot interpolation, server events
  audio/sfx.js     synthesised Web Audio sounds (no audio files)
  game/
    GameCanvas.jsx scene root; camera director; viewmodel render pass
    world/         the maps: procedural textures, structures, props, colliders
      acres/       Atomic Acres: houses, vehicles, props, ground, water tower
    player/        LocalPlayer (character controller), weapons, viewmodel, input
    remote/        other players (Bloxity avatars, aim pose, glint, nameplates)
    fx/            tracers, impacts, explosions, smoke clouds, grenades, pickups
  ui/              menus, class editor, lobby, HUD, death / end screens
```

Everything visual is procedural — no model or texture files besides the Bloxity
avatar parts, which load from Bloxity's CDN. Static map meshes are merged at
load (`world/StaticBatcher.jsx`); Settings → Graphics quality picks shadow-map
size, dust and render scale, and *Auto resolution* lowers the render scale when
the frame rate drops below ~45 FPS.

## Performance

Built to run smoothly on low-end PCs without hitches:

- Everyone starts on **Low** (older saves move to it once; a player's own pick
  sticks). **Auto quality** (on by default) drops a level if the frame rate stays
  under ~40 even at the lowest render scale. *Auto resolution* trims the render
  scale first.
- **Low**: no sun shadows, fewer dust particles, render scale 0.75–1.
  **Medium**: shadows redrawn every other frame. **High**: everything, 4096
  shadow map. Every level gets the colour grade, anti-aliased in the same pass
  (FXAA, `game/ColorGrade.js`): MSAA on the HDR target cost an integrated GPU
  (Radeon 780M) more than the rest of the frame (21 ms against 6 ms at 1080p).
  FXAA finds edges from a one-channel tone curve and only tone-maps the full
  neighbourhood on edges.
- Two flash point lights shared by every muzzle flash and blast, and no lamp
  lights in the maps: every point light costs every lit pixel, flashing or not.
  Every map keeps the same light count (Hollow Creek's night is all emissive
  glow and halos, see [Maps](#maps)).
- A full match (7 other players) is ~130–160 draw calls on High, down from ~580:
  - The map is merged per material, with the whole arena as one cell (only the
    outskirts are split up for culling). Materials that differ only in colour
    share one batch, their colour baked into vertex colours (exactly the same
    picture). Matrices of static things are frozen.
  - Shadows come from positions-only stand-ins on a shadow-only layer
    (`game/layers.js`): one per map cell and one per gun. The main pass never
    sees them.
  - A player's body (six skinned parts) is merged into one mesh with one
    skeleton, frustum-culled, and their gun turns into a one-mesh LOD once it's
    as small on screen as at ~14 m (zoom-aware, so scopes still show the full
    gun).
  - The viewmodel has its own copies of its materials, and skinned and
    instanced shadow casters their own depth materials, so three.js never has
    to look a shader up again mid-frame.
- Before each render three.js walks the whole scene to update world matrices,
  hidden or not. The world scene uses a leaner walk (`game/sceneMatrices.js`)
  that skips hidden subtrees (spent effect pools, the batched map's originals)
  and the frozen static map: ~0.38 ms → ~0.05 ms per frame on the dev machine.
- Players' bodies: the proportioned rest pose is worked out once (not every
  frame), bones skip three's quaternion → Euler mirroring, the arm IK brings
  only the arms up to date (not the whole rig), and each player's kit string is
  parsed once.
- Shader first use: three reads a shader's uniform tables the first time
  something is drawn with it. On AMD through ANGLE that stalled 0.1–0.4 s even
  for shaders compiled seconds earlier (the first shot, first reload, first
  explosion). `PerfDirector` does it as soon as the driver reports each shader
  linked (a non-blocking check), so nothing waits mid-fight.
- Physics steps once per frame (`timeStep="vary"`): nothing on the client is
  simulated, and a fixed step caught up with dozens of steps after a slow frame.
- Shaders are compiled and textures uploaded ahead of time, including the
  players' bodies, name tags, every bot loadout and preset class, far LODs and
  the shadow pass's own shaders, so the first spawn, the first enemy, shot or
  grenade doesn't freeze the game. Anything new later (a player joining, a
  weapon pulled out) is compiled on its own, never the whole scene again.
- A gun + attachments combination nobody has built yet (another player's custom
  class) is built in idle time a step per frame (`prepareWeaponModel`), with
  the default-attachment gun standing in; your own class's guns are built while
  you're still in the menus.
- The sound bank is synthesised in a Web Worker, off the main thread.
- **Atomic Acres** draws in ~35–55 calls (~100k triangles) from anywhere on the
  map, against ~90–125 for Dustline:
  - Every untextured material uses one of four finishes (matte, satin, gloss,
    metal; `world/acres/materials.js`), so all the paint of a finish is one
    vertex-coloured batch; the batching cell (96 m) holds the whole town.
  - Its art is built straight into one vertex list per material
    (`world/acres/pieces.js`), no per-piece geometry, and kept: going back to
    a map reuses it. The other map's textures are painted in idle time in the
    menus (`world/prewarm.js`), and both maps keep the same lights and rock
    shader, so switching compiles no shaders.
- **Palmwood** is the cheapest map to draw: ~37 calls for the whole town (19 in
  the sun's shadow pass on High). Every leaf in it (banana leaves, palm fronds,
  grass tufts, bushes) is a bent strip in one foliage atlas, so all the foliage
  is one material; plywood, tin and tarps batch whatever their tint; the loop is
  one strip whose texture follows the curve, so the wheel ruts do too.
- **Old Quarter** draws in ~40 calls for the whole town: every stucco wall,
  inside and out, whatever its colour, is one draw, every concrete slab, stair,
  ledge and coping another; the dry grass and dead twigs are one atlas.
- **Hollow Creek** draws in ~55 calls for the whole town. Rooms, ceilings
  and curtains glow the same colour in every house, so all the rooms are one
  draw and all the curtains another; the string-light bulbs (hundreds) are 20-face specks with the
  halo doing the rest; mist sheets fade out before they reach the camera (a
  bank right in front of it filled the screen for nothing) and there are half
  as many on Low.
- **Bramblewood** draws in ~55 calls on Low. Its cost is overdraw: alpha-tested
  leaves turn off the GPU's early depth test, so every leaf behind another was
  fully lit and then covered. Materials marked `userData.prepass` (its foliage)
  are batched into two draws (`StaticBatcher`): depth only first, with the
  same shader so it cuts the same holes, then lit, testing against that depth
  without writing it. Only the front leaf is lit and nothing hidden behind the
  leaves is drawn: about 15 % off the GPU time on the 780M, no extra shaders.
- No z-fighting: ground layers sit centimetres apart with depth offsets
  (`acres.layer`), signs are offset from their boards, overlapping floors and
  slabs are cut apart before drawing, and the camera's near plane is 10 cm.
  (To check: shoot the same view twice with the camera moved 2 mm and diff
  the two; coplanar faces flicker between them, edges barely move.)
- Empty particle pools skip their update and draw.

Measured (Playwright, online match with 7 bots, 1080p, uncapped):

| | Radeon 780M (integrated) | RTX 5050 Laptop |
|---|---|---|
| Atomic Acres, Low | 75 → 124 FPS | 249 → 251 FPS |
| Atomic Acres, High | 35 → 95 FPS | 167 → 263 FPS |
| Dustline, Low | 103 FPS | 264 FPS |
| Dustline, High | 78 FPS | 221 FPS |
| Palmwood, Low | 135 FPS | 346 FPS |
| Palmwood, High | 112 FPS | 292 FPS |

Hollow Creek was measured on a later day, when the same laptop ran everything
slower; Atomic Acres the same day, for scale:

| | Radeon 780M (integrated) | RTX 5050 Laptop |
|---|---|---|
| Hollow Creek, Low | ~67 FPS (Acres 80) | 127 FPS (Acres 130) |
| Hollow Creek, High | 64 FPS | 112 FPS |
| Old Quarter, Low | 100 FPS (Acres 79) | 183 FPS |
| Old Quarter, High | 78 FPS | 131 FPS |

Bramblewood, later again (Old Quarter the same day, for scale):

| | Radeon 780M (integrated) | RTX 5050 Laptop |
|---|---|---|
| Bramblewood, Low | 71 FPS (Old Quarter 81) | 158 FPS |
| Bramblewood, High | 55 FPS | 119 FPS |

The longest frame in a 12 s fight went from 280–450 ms (shader first use) to
under 50 ms on the 780M and under 17 ms on the RTX. Earlier: High went from ~51
to ~100 FPS on the dev machine, and joining a match went from two ~0.5 s
freezes to nothing over ~0.15 s.

## Dev tools

- `/?preview=map` — orbit the map; pin a view with `&cam=x,y,z&look=x,y,z`,
  pick it with `&map=acres` or `&map=dustline`.
- `/?preview=guns` — every weapon with a spread of attachments (`&spin`,
  `&only=N` for a close-up).
- `/?preview=avatars` — every remote-player pose side by side (`&view=side`),
  `&probe` for raw rig-axis tests.
- `/?debug` — exposes `window.__dl`; `__dl.sandbox([x, y, z], yaw, cls?)` spawns
  you offline (no server) to test movement or a class's viewmodel;
  `__dl.grantXp(n)` adds XP (rank-ups, promotion banner).
