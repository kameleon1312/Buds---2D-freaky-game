# Dystrykty: działki na pustkowiach

Na pustkowiach między miastami, z dala od drogi, leży po kilka działek zarośniętych tym, co rośnie w okolicy. Bud
kupuje jedną z nich za monety, nazywa swój dystrykt i zaczyna od małego placu z ratuszem. Potem karczuje działkę
kawałek po kawałku, stawia budynki i podnosi ich poziomy. Na koniec dystrykt z fontannami, pomnikiem swojego Buda i
Iglicą widoczną z całego pustkowia budzi podziw innych graczy. Wszystkie dystrykty stoją we wspólnym świecie: każdy,
kto idzie drogą, widzi cudze budynki, nazwy, rangi i właścicieli. Od poziomu 6 gracze mogą też napadać na siebie
nawzajem. Im większe imperium, tym trudniej je podbić.

Reguły są w `packages/shared/src/land.ts` i tylko tam się je zmienia. Serwer liczy wszystko sam, a gra tylko pokazuje
stan i wysyła prośby gracza.

## Dlaczego to działa

- **Od małego do wielkiego:** start to plac z ratuszem i miejscem na dwa budynki. Każdy następny kawałek działki
  trzeba wyciąć i opłacić. Widać to od razu: las cofa się, a plac rośnie.
- **Własność na widoku:** dystrykt nie jest schowany na osobnej mapie. Stoi przy drodze, którą chodzą wszyscy. Nazwa,
  ranga, właściciel i rozmach budynków są widoczne dla każdego, kto przechodzi obok.
- **Wyścig o miejsce:** działek jest mało (4 na pustkowie, razem 16), a każda może mieć tylko jednego właściciela.
- **Czas jest zasobem:** budynki produkują w czasie rzeczywistym, ale mieszczą tylko 8 godzin zapasu. Ekipa karczuje
  jeden kawałek naraz.
- **Poziom otwiera drzwi:** wycinka, poziomy budynków i ratusza wymagają wyższego poziomu Buda. Dystrykt rośnie razem
  z Budem.
- **Prestiż:** ranga dystryktu (Osada → Legenda Pogranicza) rośnie z terenem, budynkami i budowlami, które budzą
  podziw. Większy dystrykt to też silniejsza obrona.

## Działki

- **Rozmieszczenie:**
  - generator pustkowi (`tools/world/maps/routes.ts`) kładzie po dwie działki 25×25 pól po obu stronach drogi;
  - działki z przeciwnych stron są przesunięte, więc żadne dwie nie stoją naprzeciw siebie;
  - od drogi dzieli je co najmniej 6 pól, a działki po tej samej stronie co najmniej 20;
  - generator omija kryjówki zasadzek.
- **Na mapie działka to zwykły teren pustkowia z dojazdem do bramy.** Resztę rysuje gra, bo zmienia się razem z
  dystryktem: dziką roślinność na nieoczyszczonych kawałkach, ogrodzenie, budynki i paliki na rogach działki.
- **Lista działek:** `export-maps.ts` zapisuje działki do `packages/shared/src/plots.ts` (`PLOTS`: id, pustkowie,
  lewy górny róg, strona bramy). Serwer i gra korzystają z tej samej listy.
- **Styl miejsca** (`ROUTE_STYLE`): dystrykty wyglądają jak okolica.

  | Pustkowie       | Styl   | Dzicz na działce                         | Dystrykt                                                        | Cena | Premia (+50%) |
  | --------------- | ------ | ---------------------------------------- | --------------------------------------------------------------- | ---: | ------------- |
  | Leśne Ostępy    | las    | sosny, świerki, krzaki                   | drewno, szkło, zielone dachy, jasne płyty                       |  300 | energia       |
  | Wydmy           | tropik | palmy, hibiskusy, skały na piasku        | biały tynk, turkus, strzechy z liści palmy, piaskowiec          |  350 | beton         |
  | Stary Gościniec | dwor   | sad z owocami, siano                     | kremowe ściany, cegła, dachówka, złote zdobienia, czerwony bruk |  400 | żywność       |
  | Nieużytki       | zlom   | wraki, opony, sterty złomu, suche drzewa | blacha falista, rdza, pomarańcz ostrzegawczy, ciemne płyty      |  500 | stal          |

- **Przy bramie:**
  - wolna działka ma tablicę na sprzedaż;
  - kupiona ma pylon dystryktu w swoim stylu.
  - Podejście do bramy i E pokazuje kartę:
    - wolna działka: kupno;
    - cudzy dystrykt: ranga, właściciel, prestiż, teren, obrona i przycisk „Napadnij”;
    - własny dystrykt: okno dystryktu.
- **Cena:** zależy od pustkowia (`plotPrice`: 200 + 50 × poziom wejścia).
- **Kto może kupić:** jeden Bud ma jedną działkę, od poziomu 3. Kupno i zapłata dzieją się w jednej transakcji
  (`create_land`). Gdy dwie osoby kupują jednocześnie, wygrywa pierwsza („Ktoś był szybszy”).
- **Nazwa:**
  - od 3 do 24 znaków: litery, cyfry, spacje oraz `.`, `'` i `-`;
  - przechodzi przez filtr czatu (`districtNameSchema`);
  - można ją zmienić w oknie dystryktu.

## Rozrost: wycinka kawałek po kawałku

Działka składa się z 5×5 kawałków (sektorów) po 5×5 pól. Nowy dystrykt dostaje kształt litery T z 4 kawałków
(`startSectors`): kawałek z bramą, dwa obok niego wzdłuż drogi i jeden za nim. Ratusz stoi w kawałku za bramą
(`hallSpot`). Reszta działki jest dzika: rośnie tam las, palmy, sad albo złom, a całego kawałka nie da się przejść.

- **Jak wyciąć:** podejdź na swoim placu do dzikiego kawałka i naciśnij E. Okno pokazuje koszt i czas pracy ekipy, a
  potem „Oczyść” (`POST /v1/land/clear`). Stan wycinki widać też w zakładce Teren.
- **Warunki** (`clearProblem`):
  - kawałek musi graniczyć z tym, co dystrykt już ma;
  - ekipa pracuje nad jednym kawałkiem naraz;
  - ratusz pozwala na 6, 9, 13, 18 albo 25 kawałków (poziomy 1–5);
  - trzeba mieć poziom Buda, surowce i monety.
- **Koszt** rośnie z każdym kawałkiem (`clearingCost(k)`, k = ile już wycięto):

  | Kawałek  | Monety | Surowce                                        | Poziom Buda | Praca ekipy |
  | -------- | -----: | ---------------------------------------------- | ----------: | ----------- |
  | 1. (k=0) |     60 | 20 betonu                                      |           3 | 1 min       |
  | 5. (k=4) |    280 | 68 betonu, 32 stali, 40 energii                |           5 | 11 min      |
  | 11.      |    910 | 140 betonu, 80 stali, 100 energii, 80 żywności |           8 | 26 min      |
  | 21.      |   2760 | 260 betonu, 160 stali, 200 energii, 160 żywn.  |          13 | 51 min      |

- **Co daje wycinka:** przy okazji wpada trochę surowca, z którego słynie pustkowie (20 + 6k sztuk, w granicach
  magazynu).
- **Na mapie:** kawałek w pracy pokazuje koparkę, stos bali (piaskowiec, siano albo złom, zależnie od stylu) i
  pniaki. Gdy ekipa skończy, kawałek dostaje kostkę w stylu dystryktu. Wzdłuż krawędzi działki staje ogrodzenie
  (drewniane, bambusowe, kute albo siatka), a brama zostaje otwarta.
- Serwer liczy koniec pracy leniwie (`settle`). Gra pokazuje gotowy kawałek, gdy tylko minie czas.

## Budynki

Budynki stawia się tylko na wyciętym terenie. Serwer sprawdza też, czy nowy budynek nie odciąłby drogi do innych drzwi
(`walls_in`), a dwa rzędy przy bramie zawsze zostają wolne.

| Budynek             | Rozmiar | Daje                        | Na godzinę (poz. 1 → 5) | Ile sztuk (ratusz 1 → 5) |
| ------------------- | ------- | --------------------------- | ----------------------- | ------------------------ |
| Ratusz              | 3×3     | serce dystryktu             | —                       | 1                        |
| Apartamentowiec     | 3×3     | czynsz (monety)             | 4 → 24                  | 1 → 3                    |
| Szklarnia pionowa   | 3×3     | żywność                     | 20 → 126                | 2 → 6                    |
| Farma solarna       | 3×3     | energia                     | 20 → 126                | 1 → 3                    |
| Betoniarnia         | 3×3     | beton                       | 24 → 150                | 1 → 3                    |
| Recykling stali     | 3×3     | stal                        | 16 → 100                | 1 → 3                    |
| Centrum logistyczne | 3×3     | +400 miejsca/poz.           | —                       | 1 → 2                    |
| Skwer               | 3×3     | +30 prestiżu, +5% czynszu   | —                       | 1 → 4                    |
| Fontanna            | 3×3     | +70 prestiżu, +8% czynszu   | —                       | od ratusza 2: 1 → 2      |
| Pomnik Buda         | 3×3     | +180 prestiżu, +12% czynszu | —                       | od ratusza 3: 1          |
| Iglica              | 5×4     | +600 prestiżu, +25% czynszu | —                       | od ratusza 5: 1          |

- **Ratusz** rośnie: pawilon (poziom 1), biurowiec z tarasem (poziomy 2–3), wieżowiec (poziomy 4–5). W każdym stylu
  wygląda inaczej: drewno z zielonym dachem, biały tynk ze strzechą, złota kopułka, blacha z pasami ostrzegawczymi.
- **Budowle prestiżowe** (skwer, fontanna, pomnik, Iglica) mają jeden poziom. Iglica w każdym stylu to inna wieża: leśna
  z drzewami na każdym piętrze, biały żagiel z lądowiskiem, klasycystyczna wieża ze złotą kopułą albo stalowy szkielet z
  neonami. Premia do czynszu sumuje się, najwyżej do +50%.
- **Plac budowy:** nowy budynek stoi najpierw jako plac budowy z żurawiem (Iglica jako duży plac).
- **Poziomy:** poziom każdego budynku jest ograniczony poziomem ratusza.
- **Czynsz** trafia od razu do portfela.
- **Magazyn:** bez centrum logistycznego mieści się po 300 sztuk każdego surowca.
- **Stawianie:**
  1. Otwórz okno dystryktu (przycisk z panoramą miasta albo B) i w zakładce Budynki wybierz „Postaw”.
  2. Przed Budem pojawia się duch budynku: zielony, gdy budynek się mieści, czerwony z powodem, gdy nie.
  3. E stawia budynek, a Esc anuluje.

**Skup** (zakładka Skup) zamienia surowce na monety w paczkach po 10: beton 4, stal 6, energia 3, żywność 3.

## Prestiż i ranga

Prestiż (`landPower`) = 8 za każdy wycięty kawałek + poziom² × waga każdego budynku (ratusz 30, apartamentowiec 12,
centrum logistyczne 8, reszta 6) + prestiż budowli (skwer 30, fontanna 70, pomnik 180, Iglica 600).

| Ranga              | Od prestiżu |
| ------------------ | ----------: |
| Osada              |           0 |
| Osiedle            |         120 |
| Dzielnica          |         400 |
| Dystrykt           |        1000 |
| Metropolia         |        2200 |
| Legenda Pogranicza |        3800 |

Rangę widać w podpowiedzi przy bramie, na karcie cudzego dystryktu i w zakładce Teren, gdzie pasek pokazuje drogę do
następnej rangi.

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
  - obrona = ⌊√prestiż⌋ %, najwyżej 60% (od prestiżu 3600);
  - tyle procent zdrowia obrońca dostaje dodatkowo, a do tego +1 pancerza za każde 6%.
- **Łup:** wygrany napad zabiera 30% surowców leżących ponad poziom chroniony, w granicach wolnego miejsca w magazynie
  napastnika. Chronione jest 100 sztuk każdego surowca plus 100 za każdy poziom centrum logistycznego. Surowce czekające
  w budynkach są bezpieczne.
- **Czego nie da się stracić:** budynków i wyciętego terenu nigdy nie da się zniszczyć ani zabrać, a dystrykt nigdy
  nie zmienia właściciela.
- **Ucieczka:** ucieczka po pierwszej wymianie ciosów liczy się jak przegrany napad.
- **Dziennik:** każdy napad trafia do dziennika broniącego się dystryktu (zakładka Napady, ostatnie 10). Widać tam, kto
  napadł, czy wygrał i co zabrał.

## Uczciwość i zasady

- **Serwer jest jedynym źródłem prawdy:**
  - produkcję i koniec wycinki liczy leniwie z czasu serwera;
  - każda zmiana to porównanie wersji (`save_land`);
  - monety przechodzą w tej samej transakcji;
  - napad zapisuje oba dystrykty naraz albo żaden (`save_raid`, wiersze blokowane w stałej kolejności).
- **Gra wysyła tylko prośby, nigdy ilości:** kup, nazwij, postaw, ulepsz, zbierz, wytnij, sprzedaj, napadnij.
- **Dane publiczne:** `GET /v1/districts/:route` pokazuje nazwę, właściciela, poziom, wycięty teren, pracującą ekipę,
  budynki, prestiż, rangę, obronę i tarczę. Zapasy surowców pozostają prywatne. Dokument, którego reguły nie umieją
  odczytać, jest pomijany, a reszta listy działa dalej.
- **Bez pay-to-win:** za prawdziwe pieniądze nie kupuje się surowców, terenu, prestiżu, obrony ani tarcz.
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
- **Ranking i mapa:** ranking prestiżu dystryktów w Rewirach i dystrykty na mapie świata.

## Technika

- **Wspólne:**
  - `packages/shared/src/land.ts`: reguły, działki, kawałki i wycinka, budynki, prestiż i rangi, obrona, łup, style,
    kształty API;
  - `plots.ts`: generowana lista działek;
  - `influence.ts`: `raidResultSchema`.
- **Serwer:**
  - `apps/api/src/land.ts`: `/v1/land`, `/v1/districts/:route`, `name`, `build`, `buildings/:id/upgrade`, `collect`,
    `clear`, `sell`, `raids`, `top`;
  - koniec napadu w `app.ts`: przeciwnik pojedynku `raid-<działka>`, `finishRaid`;
  - migracje:
    - `20261024000000_lands.sql`: `bud_lands` z unikalną działką, `create_land`, `save_land`, `save_raid`;
    - `20261026000000_lands_v2.sql`: zamyka dystrykty z pierwszego planu (etapy, stare działki) i zwraca ich cenę
      do portfeli;
  - magazyn w pamięci: `store/memory-land.ts`.
- **Gra:**
  - `Quests/Land.cs`: reguły własnego dystryktu (kawałki, wycinka, budowanie, czynsz), DTO;
  - `Quests/DistrictsWorld.cs`:
    - grafika stylu wczytywana po trochu, bez atlasu;
    - dzicz na kawałkach z jednym zderzaczem na kawałek, ekipa przy pracy, kostka i krawężnik, ogrodzenie z bramą;
    - paliki, tablice, budynki, duch;
    - jedna działka przebudowywana na klatkę;
  - `UI/LandScreen.cs`: pasek, zakładki Budynki/Teren/Skup/Napady, okno nazwy;
  - `Core/GameBootstrap.Land.cs`: brama, kupno, karta, napad, budowa, wycinka przy krawędzi dziczy;
  - wynik napadu: `FightScreen.ShowResult`.
- **Grafika:**
  - `tools/world/art/district.ts`: `dz-<styl>-*` (ratusz 1–3, budynki, skwer, fontanna, pomnik, Iglica, tablica,
    wycinka, płot) oraz wspólne `dz-budowa`, `dz-budowa-duza`, `dz-na-sprzedaz`, `dz-palik`;
  - dzicz to zwykłe rekwizyty świata;
  - ikony w `icons.ts`.
- **Testy:**
  - `packages/shared/test/land.test.ts`;
  - `apps/api/test/land.test.ts` (z wycinką i pełnym napadem rozegranym do końca);
  - `Tests/EditMode/LandTests.cs` (reguły, grafika każdego stylu, działki na mapach).
- **Sprawdzanie:** `-buds-land-demo`. Potrzebny jest sparowany Bud z monetami, sąsiad z dystryktem od poziomu 6 i
  serwer w pamięci: `SUPABASE_SERVICE_ROLE_KEY= SUPABASE_URL= LAND_SHIELD_HOURS=0`. Bez pustych kluczy API wczyta
  `.env` i będzie pisać do prawdziwej bazy. Demo:
  1. kupuje i nazywa działkę;
  2. pokazuje zakładki;
  3. stawia budynki;
  4. wycina kawałek lasu;
  5. zmienia nazwę;
  6. idzie do sąsiada i napada;
  7. pokazuje działki w pozostałych trzech stylach.
