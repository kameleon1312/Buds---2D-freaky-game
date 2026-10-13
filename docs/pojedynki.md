# Pojedynki

W każdej dzielnicy stoją postaci, z którymi można się zmierzyć (czerwony znacznik z pięścią). Podchodzisz,
naciskasz `E` i przyjmujesz wyzwanie. Walka jest turowa: wybierasz jeden z czterech ruchów (klawisze 1–4), rywal
odpowiada, a serwer rozstrzyga każdą turę. Dzięki temu XP, monet i łupu nie da się podrobić.

## Ruchy zależą od broni

Broń to przedmiot w miejscu „W ręku”. Bez niej walczysz pięściami. Każdy ruch ma w grze własną animację.

| Broń                                  | Ruchy                                   | Jak wygląda                                                      |
| ------------------------------------- | --------------------------------------- | ---------------------------------------------------------------- |
| Pięści                                | Prosty, Sierpowy, Kopniak, Garda        | szybki wypad, cios łukiem z obrotem tułowia, wyskok z kopnięciem |
| Kij (kije, pałki, laska, wiosło)      | Pchnięcie, Zamach, Młyniec, Garda       | pchnięcie końcem, szeroki zamach z góry, obrót z kijem           |
| Proca (proce, łuk, kusza)             | Strzał, Seria, Celowanie, Garda         | lecący kamyk, dwa strzały, celownik nad rywalem                  |
| Spray (spraye, gaśnica)               | Psik w oczy, Chmura, Prosty, Garda      | chmura kolorowej farby                                           |
| Mikrofon (mikrofon, megafon, boombox) | Diss, Bit, Drop, Garda                  | fale dźwięku, Bud pęcznieje od basu                              |
| Deska (deskorolka, deska surfingowa)  | Uderzenie deską, Kickflip, Ślizg, Garda | zamach deską, deska w powietrzu, odskok                          |

Efekty: **Garda** to połowa obrażeń w tej turze. **Ślizg** ułatwia unik. **Celowanie** sprawia, że następny cios
jest krytyczny. **Psik w oczy** sprawia, że rywal gorzej trafia przez 2 tury. **Diss** sprawia, że rywal słabiej
bije przez 2 tury.

## Co się liczy

- **Atak:** mocniejsze ciosy. **Pancerz:** mniej obrażeń. **Szybkość:** pierwszy ruch i uniki.
  **Szczęście:** ciosy krytyczne (×1,5).
- **Umiejętności:** Walka (+6% obrażeń za poziom), Instynkt przetrwania (uniki), Spryt (krytyki).
- **Poziom:** więcej zdrowia (60 + 10 za poziom) i trochę ataku i pancerza z doświadczenia.

## Przeciwnicy i łup

21 postaci, od poziomu 1 (Dresiarz z bramy) do 12 (Szef gangu Bazyl). Dwóch to bossowie: Hrabia Pompejusz II
i Szef gangu. Statystyki wynikają z poziomu (`scaledEnemy` w `packages/shared/src/combat.ts`).

- **XP:** maleje, gdy przerośniesz rywala (−15% za każdy poziom różnicy, najmniej 10%). Pokonany rywal odpoczywa
  45 sekund.
- **Łup:** zawsze trochę monet (więcej ze Szczęściem). Do tego, z szansą zależną od rywala, przedmiot o rzadkości z
  jego tabeli (`LOOT_TIERS`) i poziomie najwyżej o 2 wyższym niż rywal. Słabi rywale dają zwykłe i niepospolite
  rzeczy, bossowie epickie i legendarne. Przedmiot, który już masz, zamienia się w monety.

## Technicznie

- Silnik: `playTurn` w `packages/shared/src/combat.ts`, na liczbach całkowitych, z ziarnem losowości w stanie walki.
  Testy obejmują też symulację balansu (`packages/shared/test/combat.test.ts`).
- API: `POST /v1/fights` (`{ enemyId }`), `POST /v1/fights/:id/move` (`{ move }`), `POST /v1/fights/:id/flee`.
  Tabela `bud_fights`, funkcja `finish_fight` przyznaje nagrodę raz. Migracja `20261013120000_fights.sql`.
- Gra: `EnemyWorld` (postaci w świecie), `FightScreen` (arena i animacje), `GameBootstrap.Fights.cs`.
- Nowy przeciwnik: dopisz `scaledEnemy({...})` w `content/<dzielnica>.ts`, potem uruchom
  `tools/world/export-quests.ts`. Skrypt sprawdzi miejsca i wygeneruje arkusz postaci.
