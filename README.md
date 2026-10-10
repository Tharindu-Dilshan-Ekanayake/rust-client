# Dustline — client

Browser FPS built with React Three Fiber + Rapier, played with your **Bloxity**
avatar. Up to 8 players per lobby, Team Deathmatch or Free-for-all, on
*Dustline Pumpstation* — a 60 × 60 m oil yard in a hazy desert, styled after
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

The game server (`../rust-server`) must be running. The client connects to
`VITE_SERVER_URL`, or `http(s)://<page host>:3000` when unset, so LAN play works
out of the box. See `.env.example` (also `VITE_GAME_SLUG` for Bloxity login).

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
avatar parts, which load from Bloxity's CDN. Static map meshes are merged into a
few hundred batches at load (`world/StaticBatcher.jsx`); Settings → Graphics
quality picks shadow-map size, dust and render scale, and *Auto resolution*
lowers the render scale when the frame rate drops below ~45 FPS.

## Dev tools

- `/?preview=map` — orbit the map; pin a view with `&cam=x,y,z&look=x,y,z`.
- `/?preview=guns` — every weapon with a spread of attachments (`&spin`,
  `&only=N` for a close-up).
- `/?preview=avatars` — every remote-player pose side by side (`&view=side`),
  `&probe` for raw rig-axis tests.
- `/?debug` — exposes `window.__dl`; `__dl.sandbox([x, y, z], yaw, cls?)` spawns
  you offline (no server) to test movement or a class's viewmodel;
  `__dl.grantXp(n)` adds XP (rank-ups, promotion banner).
