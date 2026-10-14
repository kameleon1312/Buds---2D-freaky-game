# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Product

**Buds** — a mobile 2D top-down RPG (Unity). Players create a "bud" (ziomek / ziomeczka with a mood and a style) on the website, link it to the game with a 6-character pairing code, then progress in the game: map, NPC quests, combat, mini-games, gathering and crafting. XP is earned only in the game. UI copy is Polish; adjectives must agree with the bud's gender (`moodLabel`, `moodBlurb`, `byGender`).

## Layout

- `apps/unity` — the game (Unity 6.6, URP 2D, Input System). Code in `Assets/Buds/Scripts/{Runtime,Editor}`, tests in `Assets/Buds/Tests/EditMode`.
- `apps/web` — Next.js 15 site (Vercel): landing + bud creator, bud profile + pairing code, ranking, account (`/konto`), privacy page.
- `apps/api` — Hono API (Railway): buds, guest tokens, pairing, sprite-sheet PNGs.
- `packages/shared` — the vector bud generator (`src/bud/vector.ts`, chibi SVG), level curve, zod schemas. Single source of truth for how a bud looks.
- `supabase/` — migrations (`buds`, `bud_tokens`, `bud_pair_codes`).
- `tools/` — `check-migrations.mjs`, `export-guest-sheet.ts` (regenerates the offline guest sprite in Unity), `world/` (district art and maps: `export-art.ts` renders every prop in `world/art/*` to `Resources/World/*.png` + `props.json`; `export-maps.ts` builds the four district maps, the tutorial island and the rooms (`world/maps/interiors.ts`) from `world/maps/*` into `Resources/Maps/<id>.txt` and validates them).

## Commands

```bash
pnpm dev                 # web :3000 + api :4000 (api keeps data in memory without Supabase keys)
pnpm lint && pnpm typecheck && pnpm test
pnpm check:migrations

# Unity (headless). UNITY="/c/Program Files/Unity/Hub/Editor/6000.6.5f1/Editor/Unity.exe"
"$UNITY" -batchmode -nographics -quit -projectPath apps/unity -executeMethod Buds.EditorTools.BudsSetup.Configure -logFile -
"$UNITY" -batchmode -nographics -projectPath apps/unity -runTests -testPlatform EditMode -assemblyNames Buds.Tests -testResults results.xml
"$UNITY" -batchmode -nographics -projectPath apps/unity -executeMethod Buds.EditorTools.BudsBuild.Windows -logFile -
# smoke run with screenshots (guest, or -buds-pair CODE -buds-api http://localhost:4000);
# -buds-tour shoots every zone of every district and walks through an exit, -buds-district <id> starts elsewhere
apps/unity/Builds/Windows/Buds.exe -screen-fullscreen 0 -buds-guest -buds-tour -buds-autoshot <dir>

# world art and maps (run from apps/api, which has resvg); --preview out.png [filter] renders a contact sheet
pnpm exec tsx ../../tools/world/export-art.ts
pnpm exec tsx ../../tools/world/export-maps.ts
pnpm exec tsx ../../tools/world/export-quests.ts   # NPCs, quests, caches, opponents, items → Unity JSON, NPC/opponent sheets (validated against the maps)
# quest flow end to end: Buds.exe -buds-pair CODE -buds-api http://localhost:4000 -buds-quest-demo -buds-autoshot <dir>
# more demos with a paired bud: -buds-tour (rooms, caches), -buds-gear-demo (shop, equip), -buds-fight-demo [-buds-fight-enemy <id>], -buds-ride-demo (ride, drinks, training; run after -buds-tour for coins)
```

Look at the autopilot screenshots after any gameplay or rendering change — tests don't show what the game looks like.

## Conventions

- **Bud look is generated, never stored as pixels.** The API stores `look` (jsonb) and rasterises the vector art with resvg at `GET /v1/buds/:slug/sheet.png` (columns = walk frames 0..2, rows = down, side-facing-left, up; 128×192 px cells, 160×240 SVG units, feet at y=220). The game downloads that sheet; never port the generator to C#. After changing the generator, rerun `tools/export-guest-sheet.ts` (offline guest sprite in Unity).
- Visual style follows the Buds design system (tokens: surface/paper/ink, lime `buds`, `gold` for the single call to action per screen, `rep` secondary, `alert` destructive; outlined interactive elements, hard lips/drops, no soft shadows or gradients, no emoji in UI). Web tokens live in `apps/web/app/globals.css`, Unity tokens and components in `UiKit.cs` — keep them in sync.
- Fonts: Rubik everywhere. Web loads it via `next/font`; Unity uses static Rubik-Black/Rubik-Bold instances (fontTools) because legacy Text can't drive a variable font's weight axis.
- Level curve lives in `packages/shared/src/level.ts` and is mirrored in `Progression.cs` — change both together.
- XP, coins, gems and owned items must only ever be granted by the server (game reports events, API validates). Never trust the client.
- Monetisation groundwork: one item catalog in `packages/shared/src/catalog.ts` (kinds, design-system rarities, `free`/`coins`/`gems`, `premium`, `available`); ownership in `bud_items` (server-written). The API rejects looks that wear items the bud doesn't own (`lockedItems`). No pay-to-win: real money buys looks, convenience and premium rides/weapons that are exactly as strong as an earned `twin` (at most 2 levels earlier; `packages/shared/src/premium.ts`, enforced by `gearProblems`). Premium shop: `POST /v1/premium/:itemId/buy` (atomic `buy_item_gems`); gems only from verified purchases (`grant_gems`). Plan and order of work: `docs/roadmap.md`.
- NPCs and quests: content per district in `packages/shared/src/content/<district>.ts` (schema/rules in `quests.ts`, how-to in `docs/questy.md`). Quests can grant a catalog item (`rewardItem`). Skills (`packages/shared/src/skills.ts`): one point per level, spent only through `POST /v1/buds/me/skills/:id/upgrade` (atomic `upgrade_skill` SQL function); the in-game Bud panel (`BudPanel.cs`, `GameBootstrap.Panel.cs`) shows profile, inventory and skills. Item/skill icons live in `tools/world/art/icons.ts`. The API grants quest XP once via `POST /v1/buds/me/quests/:id/complete` (validated with `questBlocker`, atomic `complete_quest` SQL function). After editing content run `tools/world/export-quests.ts`; the game logic lives in `QuestLog` (plain class) and `QuestWorld`/`GameBootstrap.Quests.cs`.
- Districts: Miasto Ziomków (start, hub), Las Palmas, Dwór Carski, Los Karkos — design in `docs/districts.md`, registry in `packages/shared/src/districts.ts`, mirrored in Unity `Districts.cs` (change both together). A district is a big map (city centre + outskirts) and, later, its own multiplayer room.
- Guest auth: `Authorization: Bearer <player token>`; only sha256 hashes are stored. One bud can have many tokens (one per device).
- Every request/response shape lives in `packages/shared` as a zod schema. New API behaviour touching auth, CORS, headers or limits needs a test.
- Migrations: never edit one that is already on `main`; every new table gets RLS enabled.
- Unity: world and UI are built from code at runtime; the only scene is `Assets/Buds/Scenes/Main.unity` (camera + `GameBootstrap`). 1 tile = 1 world unit.
- Maps are text files (`Resources/Maps/<district>.txt`, format documented in `MapFormat.cs`): a character grid + legend (`ground [+ prop|variant] [!solid]`), ground styles, scatter rules, signs, exits, zones. The file is the single source of truth for collision (the multiplayer server will read it too). Edit the generator in `tools/world/maps` or the file directly; `DistrictMapTests` check every map (spawn, exits both ways, reachability, known props). Buildings: odd footprint widths, anchor = middle of the bottom row.
- Interiors: a district map's `[doors]` (building anchor → room id) lead into small room maps (`kind = interior`, `outside = <district>`, id `<district>-<place>`), built by `tools/world/maps/interiors.ts`; the room's doormat exit leads back in front of the door (`WorldMap.ArrivalFrom`). `m.door()` puts an entrance mat in front and clears 1×1 props there. Travel between maps fades (`GameBootstrap.Travel`).
- Hidden caches (skrytki): `caches` in `content/<district>.ts` (schema in `packages/shared/src/caches.ts`), invisible until the bud is within `CacheLog.RevealRadius` (Spryt widens it); coins + XP granted once by `POST /v1/buds/me/caches/:id/open` (atomic `open_cache` SQL function). Logic in `CacheLog`, view in `CacheWorld`, exported by `export-quests.ts`.
- Gear: eight slots head to toe plus the ride (`mount`) (`packages/shared/src/gear.ts`); catalog items with `slot` + `bonus` (speed / armor / luck / skill ranks, capped, gear adds at most +2 per skill). Stats formula mirrored in Unity `Quests/Gear.cs` (change both). Premium items with power must copy an earned twin (`gearProblems`, tested); drinks are never premium. Coin shop: `shop: true` items, `POST /v1/shop/:itemId/buy` (atomic `buy_item`). Luck adds cache coins on the server. Own brand names only. Details: `docs/ekwipunek.md`.
- Look: per-gender standard catalogs for hair, top, legs and shoes with their own colours (`bud/constants.ts`, append-only lists; new look fields have defaults). The game creates buds itself: `CreatorScreen` reads `GET /v1/look/options`, previews via `GET /v1/look/sheet.png?look=<base64url>` (own rate limit), creates with `POST /v1/buds`. Details: `docs/wyglad.md`.
- New buds start on the tutorial island `wyspa-startowa` (`TUTORIAL_ISLAND` in districts.ts, `Districts.Tutorial` in Unity — not a district); its pier opens after the final quest (`wyspa-rejs`) and leads one way to Miasto Ziomków. Quest steps also have `duel` (win against an enemy). Districts are 176×132 with `[plots]` kept clear for future content (`m.plot`, `outskirts.ts`).
- Gear table: `packages/shared/src/gear-items.ts` (100+ items, `minLevel` gates wearing and buying, held items are weapons with a `weapon` kind; icons in `tools/world/art/gear-icons.ts`). Duels: turn-based, resolved on the server one turn at a time (`combat.ts` `playTurn`, integer maths, seeded RNG in the state; `POST /v1/fights`, `/:id/move`, `/:id/flee`; atomic `finish_fight`). Moves come from the weapon kind and carry an animation tag the game plays (`FightScreen`). Opponents: `enemies` in `content/<district>.ts` via `scaledEnemy` (stats from level), sheets in `Resources/Enemies/`; loot by rarity tier (`rollLoot`). Balance is simulated in `packages/shared/test/combat.test.ts`. Details: `docs/pojedynki.md`.
- Training, perks, drinks, rides (`docs/umiejetnosci.md`): effective skill rank = spent points + training ranks (`effectiveRank`, every 100 training XP); ranks 3 and 5 unlock perks (`PERKS`, derived, never stored; special duel moves via `PERK_MOVES`). Training stations: `content/training.ts`, mini-game `TimingGame`/`TrainingScreen`, `POST /v1/buds/me/training/:spotId` (atomic `train` with a cooldown). Energy drinks: `kind: consumable` with `drink` (boosts in `consumables.ts`), bought repeatedly (`buy_consumable`), drunk via `POST /v1/buds/me/consumables/:id/use`; the server applies boosts in duels, caches and training. Rides: the `mount` slot with `mountSpeed` (outside the gear speed cap), drawn by `BudController.SetRide` from `jazda-<kind>-bok/-przod/-tyl`, speed in `Rides.SpeedMultiplier`; outdoors only. Never for real money (`gearProblems`).
- Accounts: Supabase Auth (e-mail + password) on the website (`/konto`); the API verifies account tokens with the project JWKS (ES256) or the legacy HS256 secret (`middleware/auth.ts`). A bud belongs to an account via `buds.user_id` (created while signed in, or claimed with the guest token). Private bud data only through `/v1/account/*`; the public profile shows name, look, level. The web reads the repo-root `.env` (next.config.ts).
- Movement is `BudMotor` (plain class: acceleration, running with Shift / a long stick drag, facing hysteresis, corner assist); `BudController` only applies it. The map screen (`MapScreen`, M) draws `MapPicture` with the per-device fog of war (`Exploration`).
- Look: ground layers are meshes traced from blurred tile masks (`GroundShapes`, rounded corners, colour bands, no outlines) in 32×32 chunks; props are y-sorted sprites (`WorldView.SortOrderFor`) packed into one atlas per district; fences auto-join (`x-post` + `x-h`/`x-v`). Only characters carry the black outline. Keep logic in plain classes so it is testable in EditMode.
- Secrets only via env vars; `.env.example` documents every variable.

## CI (must stay green)

`CI / Lint`, `CI / Type check`, `CI / Build Web`, `CI / API security tests`, `CI / Migration drift check`, `CI / Secret scan`, `Security checks / Secrets and dependency audit`. Unity is not in CI yet (needs a Unity license secret, e.g. GameCI).
