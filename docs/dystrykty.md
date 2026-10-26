# Dystrykty: działki na pustkowiach

Na pustkowiach między miastami, wzdłuż drogi, leżą ogrodzone działki. Bud kupuje jedną z nich za monety, nazywa swój
dystrykt i rozbudowuje go z każdym poziomem i każdą partią surowców. Wszystkie dystrykty stoją we wspólnym świecie:
każdy, kto idzie drogą, widzi cudze budynki, nazwy i właścicieli. Od poziomu 6 gracze mogą też napadać na siebie
nawzajem. Im większe imperium, tym trudniej je podbić.

Reguły są w `packages/shared/src/land.ts` i tylko tam się je zmienia. Serwer liczy wszystko sam, a gra tylko pokazuje
stan i wysyła prośby gracza.

## Dlaczego to działa

- **Własność na widoku:** dystrykt nie jest schowany na osobnej mapie. Stoi przy drodze, którą chodzą wszyscy.
  Nazwa, właściciel i rozmach budynków są widoczne dla każdego, kto przechodzi obok.
- **Wyścig o miejsce:** działek jest mało (6 na pustkowie, razem 24), a każda może mieć tylko jednego właściciela.
- **Czas jest zasobem:** budynki produkują w czasie rzeczywistym, ale mieszczą tylko 8 godzin zapasu.
- **Poziom otwiera drzwi:** kolejne etapy rozbudowy, poziomy budynków i ratusza wymagają wyższego poziomu Buda.
  Dystrykt rośnie razem z Budem.
- **Rywalizacja:** cudze dystrykty można napadać. Większy dystrykt to silniejsza obrona, więc opłaca się rosnąć.
  Przegrana nigdy nie odbiera budynków.

## Działki

- **Rozmieszczenie:** generator pustkowi (`tools/world/maps/routes.ts`) wytycza po obu stronach drogi działki 23×23
  pola. Pustkowia mają teraz 150×96 pól (`ROUTE_WIDTH`), żeby działki się zmieściły.
- **Wygląd działki:** trawnik w niskim, nowoczesnym ogrodzeniu (`dzialka-post`). Pośrodku boku od strony drogi jest
  brama, a od bramy do drogi prowadzi dojazd.
- **Lista działek:** `export-maps.ts` zapisuje działki do `packages/shared/src/plots.ts` (`PLOTS`: id, pustkowie,
  lewy górny róg, strona bramy). Serwer i gra korzystają z tej samej listy.
- **Przy bramie:**
  - wolna działka ma tablicę na sprzedaż;
  - kupiona ma pylon dystryktu.
  - Podejście do bramy i E pokazuje kartę:
    - wolna działka: kupno;
    - cudzy dystrykt: właściciel, moc, obrona i przycisk „Napadnij”;
    - własny dystrykt: okno dystryktu.
- **Cena:** zależy od pustkowia (`plotPrice`: 200 + 50 × poziom wejścia).

  | Pustkowie       | Cena | Premia (+50%) |
  | --------------- | ---: | ------------- |
  | Leśne Ostępy    |  300 | energia       |
  | Wydmy           |  350 | beton         |
  | Stary Gościniec |  400 | żywność       |
  | Nieużytki       |  500 | stal          |

- **Kto może kupić:** jeden Bud ma jedną działkę, od poziomu 3. Kupno i zapłata dzieją się w jednej transakcji
  (`create_land`). Gdy dwie osoby kupują jednocześnie, wygrywa pierwsza („Ktoś był szybszy”).
- **Nazwa:**
  - od 3 do 24 znaków: litery, cyfry, spacje oraz `.`, `'` i `-`;
  - przechodzi przez filtr czatu (`districtNameSchema`);
  - można ją zmienić w oknie dystryktu.

## Rozrost: cztery etapy

Dystrykt zaczyna jako plac 9×9 pól pośrodku działki, z ratuszem w środku. Na placu leży jasna kostka z krawężnikiem, a
od bramy prowadzi wybrukowany chodnik. Rozbudowa (zakładka Rozbudowa, `POST /v1/land/grow`) poszerza plac:

| Etap | Plac  | Koszt                                             | Poziom Buda | Ratusz |
| ---- | ----- | ------------------------------------------------- | ----------: | -----: |
| 1    | 9×9   | (kupno działki)                                   |           3 |      1 |
| 2    | 13×13 | 150 betonu, 80 stali, 150 monet                   |           5 |      2 |
| 3    | 17×17 | 450 betonu, 300 stali, 120 energii, 400 monet     |           8 |      3 |
| 4    | 21×21 | 1000 betonu, 750 stali, 350 energii, 250 żywności |          11 |      4 |

Etap 4 kosztuje dodatkowo 900 monet. Na ostatnim etapie plac sięga ogrodzenia, ale dwa rzędy przy bramie zostają
wolne.

## Budynki

Budynki stawia się tylko na placu bieżącego etapu. Serwer sprawdza też, czy nowy budynek nie odciąłby drogi do innych
drzwi (`walls_in`).

| Budynek             | Rozmiar | Daje              | Na godzinę (poz. 1 → 5) | Ile sztuk (ratusz 1 → 5) |
| ------------------- | ------- | ----------------- | ----------------------- | ------------------------ |
| Ratusz              | 5×4     | serce dystryktu   | —                       | 1                        |
| Apartamentowiec     | 3×3     | czynsz (monety)   | 4 → 24                  | 1 → 3                    |
| Szklarnia pionowa   | 3×3     | żywność           | 20 → 126                | 2 → 6                    |
| Farma solarna       | 3×3     | energia           | 20 → 126                | 1 → 3                    |
| Betoniarnia         | 3×3     | beton             | 24 → 150                | 1 → 3                    |
| Recykling stali     | 3×3     | stal              | 16 → 100                | 1 → 3                    |
| Centrum logistyczne | 3×3     | +400 miejsca/poz. | —                       | 1 → 2                    |

- **Ratusz** rośnie: szklany pawilon (poziom 1), biurowiec z tarasem (poziomy 2–3), wieżowiec (poziomy 4–5).
- **Plac budowy:** nowy budynek stoi najpierw jako plac budowy z żurawiem.
- **Poziomy:** poziom każdego budynku jest ograniczony poziomem ratusza.
- **Czynsz** trafia od razu do portfela.
- **Magazyn:** bez centrum logistycznego mieści się po 300 sztuk każdego surowca.
- **Stawianie:**
  1. Otwórz okno dystryktu (przycisk z panoramą miasta albo B) i w zakładce Budynki wybierz „Postaw”.
  2. Przed Budem pojawia się duch budynku: zielony, gdy budynek się mieści, czerwony z powodem, gdy nie.
  3. E stawia budynek, a Esc anuluje.

**Skup** (zakładka Skup) zamienia surowce na monety w paczkach po 10: beton 4, stal 6, energia 3, żywność 3.

## Napady

- **Kto i na kogo:**
  - napadać można od poziomu 6;
  - celem może być tylko dystrykt właściciela, który też ma co najmniej poziom 6;
  - napastnik musi mieć własny dystrykt, bo łup musi gdzieś trafić.
- **Ochrona:**
  - nowy dystrykt jest chroniony przez 48 h (`LAND_SHIELD_HOURS`; zmniejsza się ją tylko na serwerze testowym);
  - po udanym napadzie dystrykt dostaje 12 h tarczy;
  - dziennie można zacząć 5 napadów;
  - nieudany napad na ten sam dystrykt można powtórzyć po 60 minutach.
- **Walka:** to pojedynek z zapisanym zawodnikiem właściciela (sprzęt, umiejętności i atuty, bez napojów), wzmocnionym
  **obroną dystryktu**:
  - obrona = ⌊√moc × 1,5⌋ %, najwyżej 60%;
  - tyle procent zdrowia obrońca dostaje dodatkowo, a do tego +1 pancerza za każde 6%;
  - moc dystryktu = etap × 15 + suma poziom² × waga budynku (ratusz 30, apartamentowiec 12, centrum logistyczne 8,
    reszta 6).
- **Łup:** wygrany napad zabiera 30% surowców leżących ponad poziom chroniony, w granicach wolnego miejsca w magazynie
  napastnika. Chronione jest 100 sztuk każdego surowca plus 100 za każdy poziom centrum logistycznego. Surowce czekające
  w budynkach są bezpieczne.
- **Czego nie da się stracić:** budynków nigdy nie da się zniszczyć ani zabrać, a dystrykt nigdy nie zmienia
  właściciela.
- **Ucieczka:** ucieczka po pierwszej wymianie ciosów liczy się jak przegrany napad.
- **Dziennik:** każdy napad trafia do dziennika broniącego się dystryktu (zakładka Napady, ostatnie 10). Widać tam, kto
  napadł, czy wygrał i co zabrał.

## Uczciwość i zasady

- **Serwer jest jedynym źródłem prawdy:**
  - produkcję liczy leniwie z czasu serwera;
  - każda zmiana to porównanie wersji (`save_land`);
  - monety przechodzą w tej samej transakcji;
  - napad zapisuje oba dystrykty naraz albo żaden (`save_raid`, wiersze blokowane w stałej kolejności).
- **Gra wysyła tylko prośby, nigdy ilości:** kup, nazwij, postaw, ulepsz, zbierz, rozbuduj, sprzedaj, napadnij.
- **Dane publiczne:** `GET /v1/districts/:route` pokazuje nazwę, właściciela, poziom, budynki, moc, obronę i tarczę.
  Zapasy surowców pozostają prywatne.
- **Bez pay-to-win:** za prawdziwe pieniądze nie kupuje się surowców, mocy, obrony ani tarcz.
- **Dla młodszych graczy:**
  - nazwy przechodzą przez filtr;
  - napady działają dopiero od poziomu 6 po obu stronach;
  - obowiązują tarcze i limity;
  - budynki nigdy nie przepadają.

## Dalej

- **Więcej miejsca:** kolejne działki na nowych pustkowiach, gdy obecne się zapełnią, oraz zwalnianie działek
  porzuconych na długo.
- **Powiadomienia:** „Ktoś napadł na twój dystrykt” z przyciskiem rewanżu i 24-godzinną zemstą bez czekania.
- **Budynki obronne:** posterunek (dodatkowe ciosy w obronie) i system ochrony (pancerz).
- **Ekipy:** sąsiednie działki członków ekipy i wspólna obrona.
- **Ranking i mapa:** ranking mocy dystryktów w Rewirach i dystrykty na mapie świata.

## Technika

- **Wspólne:**
  - `packages/shared/src/land.ts`: reguły, działki, etapy, obrona, łup, kształty API;
  - `plots.ts`: generowana lista działek;
  - `influence.ts`: `raidResultSchema`.
- **Serwer:**
  - `apps/api/src/land.ts`: `/v1/land`, `/v1/districts/:route`, `name`, `build`, `buildings/:id/upgrade`, `collect`,
    `grow`, `sell`, `raids`, `top`;
  - koniec napadu w `app.ts`: przeciwnik pojedynku `raid-<działka>`, `finishRaid`;
  - migracja `20261024000000_lands.sql`: `bud_lands` z unikalną działką, `create_land`, `save_land`, `save_raid`;
  - magazyn w pamięci: `store/memory-land.ts`.
- **Gra:**
  - `Quests/Land.cs`: reguły własnego dystryktu, DTO;
  - `Quests/DistrictsWorld.cs`: działki, kostka, budynki, tablice, duch, kolizje;
  - `UI/LandScreen.cs`: pasek, cztery zakładki, okno nazwy;
  - `Core/GameBootstrap.Land.cs`: brama, kupno, karta, napad, budowa;
  - wynik napadu: `FightScreen.ShowResult`.
- **Grafika:** `tools/world/art/district.ts` (`dz-*`, `dzialka-*`), ikony w `icons.ts`.
- **Testy:**
  - `packages/shared/test/land.test.ts`;
  - `apps/api/test/land.test.ts` (z pełnym napadem rozegranym do końca);
  - `Tests/EditMode/LandTests.cs` (działki na mapach, ogrodzenie i brama).
- **Sprawdzanie:** `-buds-land-demo`. Do napadu potrzebny jest sparowany Bud z monetami, sąsiad z dystryktem od
  poziomu 6 i serwer z `LAND_SHIELD_HOURS=0`. Demo:
  1. kupuje i nazywa działkę;
  2. pokazuje zakładki;
  3. stawia budynki;
  4. zmienia nazwę;
  5. idzie do sąsiada i napada.
