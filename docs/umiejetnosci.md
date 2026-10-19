# Umiejętności, trening, napoje i pojazdy

Wszystko, co daje przewagę w grze, przyznaje serwer. Gra pokazuje mini-gry, liczniki i animacje, ale XP treningu,
rangi, napoje i pojazdy zapisuje tylko API.

## Umiejętności i rangi

Sześć umiejętności (`packages/shared/src/skills.ts`): Flow, Graffiti, Surfing, Spryt, Walka, Instynkt przetrwania.
Ranga, która się liczy, to suma dwóch źródeł (najwyżej 5):

- **punkty z poziomów**: jeden za każdy poziom powyżej 1, wydawane przyciskiem „Ulepsz” (`POST /v1/buds/me/skills/:id/upgrade`);
- **trening na mapie**: co `TRAINING_XP_PER_RANK` (100) XP treningu w danej umiejętności to jedna ranga.

Ekwipunek dodaje do tego najwyżej +2 (jak dotąd). W panelu kropki z punktów są jasnozielone, z treningu niebieskie,
z ekwipunku ciemnozielone.

## Wyjątkowe umiejętności (perki)

Ranga 3 i ranga 5 każdej umiejętności odblokowują perk (`PERKS`, liczone z rang, nigdzie nie zapisywane):

| Umiejętność          | Ranga 3                                                            | Ranga 5                                                |
| -------------------- | ------------------------------------------------------------------ | ------------------------------------------------------ |
| Flow                 | Rytm ulicy: +5% szybkości                                          | Freestyle mistrza: ruch „Freestyle” (2 ciosy, osłabia) |
| Graffiti             | Szybka puszka: +10% monet ze skrytek                               | Tag legendy: ruch „Tag” (oślepia)                      |
| Surfing              | Na fali: +5% szybkości                                             | Unik surfera: +10 do uniku w pojedynkach               |
| Spryt                | Szósty zmysł: skrytki widać z dalszej odległości                   | Łowca łupów: +10 pkt % szansy na łup                   |
| Walka                | Cios specjalny: ruch „Cios specjalny”                              | Mistrz ringu: +10% obrażeń                             |
| Instynkt przetrwania | Drugi oddech: raz na walkę, poniżej 25% zdrowia, wraca 1/3 zdrowia | Twardziel: +20 zdrowia                                 |

Ruchy z perków dokłada `budFighter` (`PERK_MOVES` w `combat.ts`); `FightScreen` mieści do 6 przycisków (klawisze 1–6,
specjalne ruchy w złotym kolorze).

## Trening na mapie

Stanowiska treningowe są w `packages/shared/src/content/training.ts` (po 2–3 w każdej dzielnicy i jedno na Wyspie
Startowej, każda umiejętność ma swoje miejsce). Na mapie stoi rekwizyt `trening-<look>` z limonkową chorągiewką
(`tools/world/art/rides.ts`); `export-quests.ts` sprawdza, czy stoi na wolnym, osiągalnym polu.

Przy stanowisku `E` otwiera mini-grę (`TimingGame` + `TrainingScreen`): złoty znacznik biega po pasku, trzeba go
zatrzymać w zielonym polu. 5 rund, pole się zwęża, znacznik przyspiesza. Wynik (0–5 trafień) idzie na
`POST /v1/buds/me/training/:spotId`; serwer daje 8 XP za trafienie (×2 z napojem Skupienie), raz na
`TRAINING_COOLDOWN_SECONDS` (90 s) dla każdego stanowiska (atomowa funkcja `train`). Odpowiedź mówi, czy wpadła nowa
ranga i jakie perki się odblokowały. Jak przy zadaniach: to, czy gracz naprawdę stał przy stanowisku, sprawdzi dopiero
serwer gry wieloosobowej.

## Napoje energetyczne (eliksiry)

Sześć napojów (`packages/shared/src/rides-and-drinks.ts`, efekty w `consumables.ts`):

| Napój       | Efekt                                                | Czas   |
| ----------- | ---------------------------------------------------- | ------ |
| Turbo       | +15% szybkości chodzenia, +5 Szybkości w pojedynkach | 3 min  |
| Siła        | +6 Ataku w pojedynkach                               | 5 min  |
| Pancerz     | +6 Pancerza w pojedynkach                            | 5 min  |
| Fart        | +10 Szczęścia (monety ze skrytek, krytyki)           | 5 min  |
| Skupienie   | podwójne XP z treningu                               | 10 min |
| Regeneracja | +25 zdrowia w pojedynkach                            | 5 min  |

Kupuje się je w sklepie za monety, ile razy się chce (`buy_consumable`), a w pojedynkach wypadają z szansą 25%
(`DRINK_DROP_CHANCE`, osobny strumień RNG, nie zmienia łupu). Wypicie (`POST /v1/buds/me/consumables/:id/use`,
`use_consumable`) zabiera jedną puszkę i uruchamia efekt (ponowne wypicie odnawia czas). Serwer stosuje efekty tam,
gdzie sam liczy: w pojedynkach (`budFighter`), w skrytkach (Fart), w treningu (Skupienie). Gra pokazuje liczniki pod
przyciskami HUD i w zakładce „Napoje”. Napoje nigdy nie są za prawdziwe pieniądze (`gearProblems`). Za gemy są za to unikatowe warianty pojazdów
(Deskorolka Holo, Hulajnowa Neon, Rower Chrom, Motocykl Smok, Quad Wulkan): ta sama prędkość co odpowiednik z gry,
inny wygląd (`docs/ekwipunek.md`).

## Pojazdy

Nowe miejsce w ekwipunku: **Pojazd** (`mount`). Każdy dodaje własną szybkość (`mountSpeed`), poza limitem
szybkości z ubrań:

| Pojazd             | Rzadkość     | Poziom | Szybkość | Skąd                    |
| ------------------ | ------------ | ------ | -------- | ----------------------- |
| Deskorolka Cruiser | zwykła       | 1      | +20%     | sklep                   |
| Hulajnowa Śmigacz  | niepospolita | 3      | +30%     | sklep                   |
| Rower Góral        | rzadka       | 5      | +45%     | sklep                   |
| E-hulajnowa Volt   | rzadka       | 7      | +55%     | łup                     |
| Motocykl Grzmot    | epicka       | 9      | +70%     | łup (silni przeciwnicy) |
| Quad Bestia        | legendarna   | 12     | +85%     | łup (bossowie)          |

Prędkość chodzenia w grze: `(1 + ubrania) × (1 + pojazd) × (1 + perki + Turbo)` (`Rides.SpeedMultiplier`).
Bud jedzie tylko na zewnątrz (we wnętrzach idzie pieszo); `R` albo przycisk „Zsiądź / Wsiądź” w HUD. Grafika:
`jazda-<rodzaj>-bok / -przod / -tyl` w `tools/world/art/rides.ts` — widok z boku rysowany za Budem, z przodu i z tyłu
przed nim (kierownica, koła), deskorolka zawsze pod stopami.

## Baza danych

Migracja `20261013130000_training_drinks_mounts.sql`: miejsce `mount` w `bud_equipment`, tabele `bud_training`,
`bud_training_spots`, `bud_consumables`, `bud_buffs` (RLS, bez polityk — pisze tylko API) i funkcje `train`,
`buy_consumable`, `grant_consumable`, `use_consumable`.

## Sprawdzanie

```bash
pnpm test                              # shared/test/skills.test.ts, api/test/training.test.ts
# Unity: RideTests (pojazdy, napoje, stanowiska, mini-gra)
# autopilot z połączonym Budem: kupuje deskorolkę i napoje, jeździ, pije Turbo, trenuje
Buds.exe -buds-pair KOD -buds-api http://localhost:4000 -buds-tour -buds-ride-demo -buds-autoshot <dir>
```
