# Modern Guns — client

**Modern Guns** is a browser FPS built with React Three Fiber + Rapier, played
with your **Bloxity** avatar. Up to 8 players per lobby, Team Deathmatch or
Free-for-all, on *Dustline Pumpstation* — a 60 × 60 m oil yard in a hazy desert, styled after
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
| B | Change class (applies next spawn) |
| Tab / Esc | Scoreboard / menu (the match keeps running) |

## Private matches

Play → *Create a room* picks TDM or FFA, the size (1v1 to 4v4 / 2 to 8 players)
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
artillery), with a few variations each. Everything shares a generated outdoor
reverb, and distant sounds arrive late (speed of sound) and muffled.
`audio/music.js` renders a 48 s war score loop offline; it plays full in the
menus and tucked low under a match, where distant battle ambience takes over.
Settings has separate master and music volume.

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
  shared/          copied from the server — weapons, map, hitboxes, constants
  store/           zustand: screens, classes (localStorage), settings, HUD
  net/network.js   Colyseus connection, snapshot interpolation, server events
  audio/sfx.js     synthesised Web Audio sounds (no audio files)
  game/
    GameCanvas.jsx scene root; camera director; viewmodel render pass
    world/         the map: procedural textures, structures, props, colliders
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

- **Auto quality** (Settings, on by default) picks Low / Medium / High from the
  GPU and CPU on first run, and drops a level if the frame rate stays under ~40
  even at the lowest render scale. *Auto resolution* trims the render scale first.
- **Low**: no sun shadows, no colour grade, fewer dust particles. **Medium**:
  shadows redrawn every other frame, 2x MSAA on the grade. **High**: everything.
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
- The arm IK reads world matrices directly instead of rebuilding every
  ancestor several times per arm per player.
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

Measured (Playwright, online match with 7 bots, uncapped): High went from ~51 to
~100 FPS on the dev machine, and from 3 to 10 FPS with Chrome's 4x CPU
throttle; joining a match went from two ~0.5 s freezes to nothing over ~0.15 s.

## Dev tools

- `/?preview=map` — orbit the map; pin a view with `&cam=x,y,z&look=x,y,z`.
- `/?preview=guns` — every weapon with a spread of attachments (`&spin`,
  `&only=N` for a close-up).
- `/?preview=avatars` — every remote-player pose side by side (`&view=side`),
  `&probe` for raw rig-axis tests.
- `/?debug` — exposes `window.__dl`; `__dl.sandbox([x, y, z], yaw, cls?)` spawns
  you offline (no server) to test movement or a class's viewmodel;
  `__dl.grantXp(n)` adds XP (rank-ups, promotion banner).
