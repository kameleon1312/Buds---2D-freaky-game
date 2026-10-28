# Walka

Walka toczy się w świecie, w głównym widoku, jak w grach MOBA. Nie ma osobnej areny ani tur. Podchodzisz, bijesz,
uskakujesz z czerwonych pól i wracasz do gry. Jedna symulacja na mapę liczy każdy cios na serwerze, 20 razy na
sekundę. Dzięki temu nie da się podrobić trafienia, czasu odnowienia ani nagrody.

## Sterowanie

**Telefon** (układ jak w Wild Rift):

- gałka po lewej, przyciski walki po prawej;
- duży przycisk to cios podstawowy:
  - stuknięcie bije najbliższego wroga w zasięgu (o krok za daleko: Bud sam podchodzi);
  - przytrzymanie bije dalej;
- wokół są dwie umiejętności i garda, dalej supercios (złota obwódka, od poziomu 5);
- przeciągnięcie przycisku celuje, zasięg widać na ziemi, a puszczenie odpala;
- przeciągnięcie na „Anuluj” odwołuje cios;
- kilka palców naraz: jeden steruje, drugi bije.

**Komputer**:

- WASD (Shift: bieg);
- mysz celuje;
- lewy przycisk to cios podstawowy w stronę kursora (do wroga pod kursorem);
- 1–4 to umiejętności: przytrzymanie pokazuje zasięg pod kursorem, puszczenie odpala.

Przyciski są widoczne także na komputerze, z klawiszami pod spodem. Odnowienie zaciemnia przycisk jak zegar i
odlicza sekundy. Gotowy przycisk błyska zielenią.

## Pięć przycisków

Przyciski zależą od broni w ręku (`kitOf` w `packages/shared/src/brawl.ts`):

| Przycisk | Co to jest                                                  |
| -------- | ----------------------------------------------------------- |
| 0        | Cios podstawowy broni                                       |
| 1, 2     | Dwie umiejętności                                           |
| 3        | Garda: tarcza z części zdrowia, Kontra dodatkowo bije wokół |
| 4        | Supercios od poziomu 5                                      |

Supercios każdej broni:

- pięści: „Nokaut”, skok z ogłuszeniem;
- kij: „Home run”;
- proca: „Deszcz kamieni”;
- spray: „Ściana farby”;
- mikrofon: „Koncert”;
- deska: „Rampa”.

Supercios z umiejętności (Freestyle, Tag, Cios specjalny) zastępuje supercios broni.

Wyuczone ruchy zostają: mocniejsza wersja zastępuje ruch na tym samym przycisku. Każdy ruch z `combat.ts` ma swój
kształt w `ABILITIES`:

- `melee`: jeden cios przed sobą;
- `arc`: wszyscy w klinie;
- `proj`: lecące kamienie, farba, dźwięk;
- `line`: pas;
- `circle`: obszar w wybranym miejscu;
- `self`: obszar wokół siebie;
- `dash`: wypad, który bije po drodze i może wylądować obszarem;
- `buff`, `shield`: na siebie.

Każdy kształt ma zasięg, czas zamachu i odnowienie, a do tego obrażenia, ogłuszenie, unieruchomienie, spowolnienie,
odrzut, tarczę, oślepienie lub osłabienie. Ikony przycisków rysuje `tools/world/art/ability-icons.ts`
(`Resources/Abilities`).

## Twoje ciosy

Każdy Bud sam układa swoje pięć przycisków, osobno dla każdej broni (Twój Bud → Ciosy,
`packages/shared/src/loadout.ts`):

- **Pula na każdy przycisk** (`movePool`):
  - cios: podstawowy broni albo jego mocniejsza wersja;
  - umiejętności: ruchy broni, ich mocniejsze wersje i Podcięcie (dla każdej broni);
  - garda: Garda, Kontra albo Zryw (przyspieszenie z unikiem);
  - supercios: broni albo z atutu.
- **Odblokowanie** (`unlockOf`): poziom, a mocniejsze wersje także umiejętność broni; superciosy z atutów wymagają
  atutu. Zamknięty cios pokazuje, czego brakuje („Poziom 7 · Walka 2”).
- **Zapis** (`PUT /v1/buds/me/moves/loadout`): serwer sprawdza, czy cios pasuje do przycisku, jest odblokowany i
  czy dwie umiejętności są różne (`kitProblem`). Przy budowaniu zawodnika sprawdza jeszcze raz (`resolveKit`), więc
  po zmianie broni albo umiejętności nic się nie psuje.
- **Ulepszenia** (`POST /v1/buds/me/moves/:id/upgrade`, atomowe `upgrade_move`): każdy cios trzy razy, za monety z
  gry i od poziomu (`rankCost`, `rankLevel`). Stopień daje +10% obrażeń, −6% odnowienia i +12% czasu ogłuszenia,
  spowolnienia i innych efektów (`rankDamage`, `rankCooldown`, `rankHold`). Nic za prawdziwe pieniądze.

Na przyciskach walki złote kropki pokazują stopnie ulepszeń.

## Panel walki

Panel pojawia się tylko w walce:

- poza walką nie ma przycisków;
- gdy wróg jest blisko (`ReadyRange`), wysuwa się sam cios;
- po pierwszym ciosie (zadanym albo przyjętym) wokół niego rozkłada się cały łuk, przycisk po przycisku, i składa
  się kilka sekund po ostatnim ciosie.

Przyciski są wypukłe jak reszta gry (obręcz, twarz, twarda warga, odblask): cios ma limonkową twarz i nie wygląda
jak gałka ruchu. Umiejętności leżą w równym łuku wokół ciosu (`CombatPad.Layout`, test pilnuje, że się nie
stykają).

## Wygląd ciosów

Każdy rodzaj ciosu wygląda inaczej (`CombatFx.StyleOf`):

| Rodzaj    | Wygląd                                     |
| --------- | ------------------------------------------ |
| Pięści    | krótki biały błysk, PAC!                   |
| Kopnięcia | szeroki złoty zamach z kurzem, BUM!        |
| Kij       | gruby drewniany łuk, TRZASK!               |
| Młyniec   | dwa obracające się zamachy                 |
| Proca     | kamienie, BAM!                             |
| Snajper   | cienki świetlny ślad                       |
| Spray     | różowa farba z kroplami i kleksem          |
| Mikrofon  | fale dźwięku i kręgi                       |
| Drop      | kręgi uderzeniowe jeden po drugim z kurzem |
| Deska     | limonkowy ślad z kurzem                    |
| Supercios | podwójny krąg i duży napis                 |

Ciosy wroga mają czerwony odcień.

## Obrażenia

Obrażenia liczy ten sam wzór co dawniej (`damage`), więc sprzęt, umiejętności, perki i napoje działają tak samo:

- atak i Walka zwiększają cios;
- pancerz go zmniejsza;
- Szczęście i Spryt dają krytyki;
- Szybkość i Przetrwanie dają szansę uniku (do 25%);
- Unik surfera dodaje szansę uniku, a Mistrz ringu obrażenia;
- Twardziel zwiększa zdrowie, a Drugi oddech raz na życie oddaje część zdrowia.

Zdrowie jest razy `BRAWL_HP` (przeciwnicy z dzielnic razy `MOB_HP`, a biją `MOB_DAMAGE`%). Dzięki temu walka trwa
sekundy, a nie jeden cios. Bossowie dostają supercios i przyjmują o połowę krótsze ogłuszenia. Odrzut ich nie
przesuwa. Zdrowie wraca samo po `OUT_OF_COMBAT_MS` bez ciosów.

Balans sprawdza `packages/shared/test/brawl.test.ts`. Bot walczy jak gracz:

| Walka                | Czas    | Wynik                                    |
| -------------------- | ------- | ---------------------------------------- |
| Na równym poziomie   | 15–20 s | Bud kończy z mniej więcej połową zdrowia |
| Dwa poziomy niżej    | dłużej  | na styk                                  |
| Kilka poziomów niżej | —       | przegrana                                |

Każda broń wygrywa równą walkę.

## Przeciwnicy z dzielnic

Stoją tam, gdzie zawsze (`enemies` w `content/<dzielnica>.ts`). Dopóki nikt ich nie uderzy, są spokojni. Po
pierwszym ciosie:

- idą za tym, kto ich bije (A* po siatce chodzenia, `findPath`);
- biją, czasem użyją umiejętności;
- zwolnione ciosy zapowiadają czerwonym polem na ziemi, które wypełnia się do chwili uderzenia (z pola da się
  uciec);
- odprowadzeni dalej niż `LEASH` od swojego miejsca odpuszczają, wracają i leczą się.

Czający się na pustkowiach (`ambush`) siedzą ukryci w krzakach. Wyskakują sami, gdy Bud podejdzie na
`SPRING_RADIUS`. Pokonany przeciwnik pada, znika i wstaje po `MOB_RESPAWN_MS` na swoim miejscu. Każdy, kto go bił,
dostaje nagrodę:

- XP;
- monety;
- łup;
- wpływ w rewirze.

Nagrodę przyznaje `fights.ts` `winMob` raz, przez zwykły zapis walki (`createFight` i `finishFight`).

## Buda na Buda

Od poziomu `PVP_MIN_LEVEL` (6) obaj Budowie mogą się bić wszędzie poza strefami bezpiecznymi:

- rynki i bramy miast (`SAFE_TURFS`);
- przystanie promów;
- wszystkie wnętrza;
- wyspa startowa.

Ekipa walczy razem. Ta sama ekipa to sojusznicy (niebieskie paski, nie da się ich zranić). Wrogowie mają paski
czerwone, a własny pasek jest limonkowy.

## Nokaut

Znokautowany Bud pada na `KO_MS` (5 s) i wstaje w najbliższej strefie bezpiecznej mapy z pełnym zdrowiem. Przez
`SPAWN_GUARD_MS` nikt go nie zrani i on też nie zaczepi innego Buda. Traci drobną część monet z kieszeni, nigdy
przedmioty:

- pokonany przez przeciwnika z dzielnicy: 2%, maksymalnie 20 monet, przepadają;
- pokonany przez innego Buda na ulicy: 5%, maksymalnie 50 monet, przechodzą na zwycięzcę.

Para Budów płaci sobie najwyżej raz na `KO_PAIR_MS` (30 min). Tak samo rusza się wtedy ranking ligi, jak po
wygranej w Rewirach. Monety przesuwa atomowa funkcja `knockout_coins` (migracja `20261028000000_knockouts.sql`).

## Rywale z Rewirów i napady

„Wyzwij” w Rewirach i „Napadnij” przy cudzym dystrykcie sprawdzają wszystko jak dawniej w REST:

- zasięg poziomów;
- odpoczynek;
- tarczę;
- limit dnia.

Potem gra przywołuje rywala na ulicę (`summon`). Jego zapisany wojownik (w napadzie wzmocniony obroną dystryktu)
wychodzi jako cień obok Buda:

- bije się tylko z wyzywającym;
- wygrana przyznaje ranking (`finishPvp`) albo łup napadu (`finishRaid`);
- odejście dalej niż `SHADOW_GIVE_UP` po pierwszym ciosie liczy się jako porażka, jak dawna ucieczka;
- odejście przed pierwszym ciosem nie liczy się wcale.

## Serwer

`apps/api/src/live.ts`:

- każdy pokój (mapa) ma swój `Brawl`;
- ruch dalej przychodzi od gry i jest sprawdzany (ściany, prędkość);
- w walce ostatnie słowo ma symulacja:
  - ogłuszonego, unieruchomionego i znokautowanego nie przesuwa się;
  - wypad, odrzut i wstanie to przesunięcia wymuszone z numerem `q`, który gra odsyła z każdym ruchem, więc stare
    meldunki sprzed wypadu przepadają.

Protokół jest w `packages/shared/src/live.ts`.

Gra wysyła:

- `act` (przycisk, cel, opcjonalnie wróg);
- `summon` (przywołanie rywala);
- `move` z numerem `q`.

Serwer wysyła:

| Wiadomość | Co niesie                                                                                      |
| --------- | ---------------------------------------------------------------------------------------------- |
| `ents`    | przeciwnicy i cienie na mapie                                                                  |
| `es`      | pozycje i zdrowie, 10 razy na sekundę                                                          |
| `fx`      | zdarzenia: zamach, pocisk, obszar, trafienie, status, wypad, odrzut, nokaut, wstanie, leczenie |
| `you`     | własne zdrowie, przyciski, odnowienia, drużyna, czy wolno bić Budów                            |
| `reward`  | nagroda za walkę                                                                               |
| `lost`    | nokaut i stracone monety                                                                       |

Nagrody pisze `apps/api/src/fights.ts`:

- `winMob`, `loseMob`: walki z przeciwnikami z dzielnic;
- `shadowFight`, `exchanged`, `finishShadow`: cienie z Rewirów i napadów;
- `street`: nokaut między Budami.

Testy: `apps/api/test/live.test.ts` (walka przez WebSocket), `gear.test.ts` (końce walk).

## Gra

| Plik                           | Co robi                                                                                                                             |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `Core/GameBootstrap.Combat.cs` | klej: wiadomości, przyciski, celowanie myszą, podejście do wroga, nagrody                                                           |
| `Combat/BrawlRules.cs`         | zwykłe klasy: `BrawlSelf` (przyciski i odnowienia), `BrawlAim` (auto-cel, celowanie przeciągnięciem), `BrawlLook` (strony i liczby) |
| `Combat/CombatFx.cs`           | efekty w świecie: zasięg celu, czerwone zapowiedzi, zamachy, obszary, pociski, gwiazdki i komiksowe słowa, cienie wypadu, K.O.      |
| `UI/CombatPad.cs`              | przyciski                                                                                                                           |
| `UI/CombatUi.cs`               | paski zdrowia nad głowami (nie nachodzą na siebie), liczby ciosów, napis NOKAUT                                                     |
| `Characters/CombatPose.cs`     | ciało w walce: wypad, zamach, drgnięcie i błysk, padanie na bok i wstawanie, gwiazdki ogłuszenia, krąg tarczy, odcienie efektów     |

Przeciwnikami porusza serwer (`EnemyView.Apply`). Testy: `Tests/EditMode/CombatTests.cs`.

Demo walki:

```bash
Buds.exe -buds-pair CODE -buds-api http://localhost:4000 -buds-fight-demo [-buds-fight-enemy <id>] -buds-autoshot <dir>
```

Bot walczy przyciskami. Robi zdjęcia podejścia, celowania, ciosów i nagrody. Rewiry (`-buds-rivalry-demo`), napady
(`-buds-land-demo`), wyspa startowa (`-buds-tutorial-demo`) i zasadzki (`-buds-travel-demo`) walczą tym samym botem
(`FightIt`).
