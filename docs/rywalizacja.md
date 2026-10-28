# Rywalizacja

Od wyjścia z wyspy startowej gracz walczy o to, żeby być lepszym od innych Budów. Liczy się tydzień: w
poniedziałek o 00:00 UTC wszystko rusza od zera, a zwycięzcy poprzedniego tygodnia zatrzymują tytuły na zawsze.
O wszystkim decyduje serwer. Gra tylko pokazuje wyniki.

W grze: przycisk **Rewiry** (klawisz `G`, puszka sprayu z koroną, obok „Twój Bud”). Na stronie: `/top`.

## Rewiry i wpływ

Każda nazwana strefa dzielnicy to rewir (61 rewirów). Lista jest generowana z map przez
`tools/world/export-maps.ts` do `packages/shared/src/turfs.ts`. Pokój liczy się do rewiru, w którym stoją jego
drzwi. Wyspa startowa nie ma rewirów.

| Co zrobiłeś na rewirze               | Wpływ        | Wyzwanie tygodnia  |
| ------------------------------------ | ------------ | ------------------ |
| wygrany pojedynek z kimś z dzielnicy | 10 (boss 20) | Zwycięstwa         |
| oddane zadanie (u zleceniodawcy)     | 20           | Zadania            |
| otwarta skrytka                      | 8            | Skrytki            |
| runda treningu z wynikiem > 0        | 4            | Trening            |
| wygrana z innym Budem                | –            | Pojedynki z Budami |

Zasady:

- Na jednym rewirze można zdobyć najwyżej **120** wpływu dziennie, żeby nikt nie wygrał grindem w jednym miejscu.
- Rewirem rządzi Bud, który ma na nim najwięcej wpływu w tygodniu, ale **co najmniej 30**. Przy remisie rządzi
  ten, kto był pierwszy.
- Kto przejmie rewir, widzi natryskiwaną pieczęć **TWÓJ REWIR**. Wchodząc w strefę, gracz widzi, kto nią rządzi.
- Władca zbiera **haracz** raz dziennie: 8 + 4 × poziom dzielnicy monet. Złota kropka na przycisku Rewiry
  oznacza, że haracz czeka.

## Koniec tygodnia

Tydzień rozlicza się raz, przy pierwszym zapytaniu po jego końcu (SQL `settle_week`):

- władca każdego rewiru dostaje tytuł `turf:<rewir>` i 60 monet;
- podium tygodnia (suma wpływu) dostaje tytuły `top:1..3` i 150 / 90 / 60 monet.

## Ekipy

- Ekipa ma od 2 do 12 osób, nazwę (3–20 znaków) i tag (2–4 litery lub cyfry, wielkie).
- Wpływ członków sumuje się w rankingu ekip.
- Lider, który odchodzi, przekazuje ekipę najdłużej obecnej osobie. Ostatnia osoba zamyka ekipę.
- Zakładanie i dołączanie jest od poziomu 2.

## Pojedynki z Budami (PvP)

- Walczysz z zapisanym zawodnikiem innego Buda: jego sprzęt, umiejętności i perki, bez napojów.
- Rywal wychodzi na ulicę jako cień i walczy tylko z wyzywającym, tymi samymi przyciskami co cała walka
  (`docs/walka.md`).
- Rywale są w zasięgu ±4 poziomy. Tego samego Buda wyzywasz znowu po godzinie.
- Ranking Elo (start 1000, K = 32). Ligi: Brąz, Srebro (od 1050), Złoto (1150), Platyna (1300), Legenda (1500).
- Wygrana nie daje XP ani łupu. 5 pierwszych wygranych dziennie płaci 10 + 5 × indeks ligi monet.
  Wypłata jest atomowa (`pvp_result`), więc powtórzony ruch nie wypłaci jej drugi raz.
- Ucieczka po pierwszej wymianie ciosów albo porzucenie walki (rozpoczęcie innej) liczy się jak przegrana.

## Bazar

- Handel między graczami za monety.
- Na Bazar trafiają łupy i sprzęt z gry. Nie trafiają: rzeczy premium, napoje, startowe ubrania i nagrody z zadań.
- Założony przedmiot trzeba najpierw zdjąć.
- Cena od 5 do 5000 monet. Bazar pobiera 10% prowizji (co najmniej 1 monetę).
- Naraz możesz mieć najwyżej 5 ofert.
- Wystawiony przedmiot znika z ekwipunku, wycofany wraca z pierwotnym źródłem. Kupiony ma źródło `trade`.

## Gdzie co jest

- Zasady i schematy: `packages/shared/src/rivalry.ts`, `packages/shared/src/influence.ts`.
- Baza danych: migracja `20261017000000_rivalry.sql` (tabele z RLS, atomowe funkcje `add_influence`,
  `claim_tribute`, `settle_week`, `create_crew`, `join_crew`, `leave_crew`, `pvp_challenge`, `pvp_result`,
  `pvp_loss`, `market_list`, `market_cancel`, `market_buy`, odczyty `rival_week_totals` i inne).
- API: `apps/api/src/rivalry.ts` (trasy `/v1/rivalry/*`, `/v1/crews*`, `/v1/pvp/*`, `/v1/market*`). Magazyny:
  `store/memory-rivalry.ts`, `store/supabase-rivalry.ts`. Testy: `test/rivalry.test.ts`.
- Gra: `RivalryScreen`, `GameBootstrap.Rivalry.cs`, teksty i reguły w `Quests/Rivalry.cs`.
  Demo: `-buds-rivalry-demo`.

## Efekty

Efekty pojedynków i rywalizacji to komiksowo-uliczna grafika marki Buds: tusz, twarde cienie, półton, szablon
sprayu. Rysuje ją `tools/world/art/fx.ts`, a `export-art.ts` eksportuje do `Resources/Ui/Fx`. Podgląd:
`export-art.ts --fx-preview out.png`.

| Efekt                            | Kiedy                                                |
| -------------------------------- | ---------------------------------------------------- |
| PAC! / ŁUP! / BAM!               | trafienie; słowo zależy od ciosu                     |
| TRZASK!                          | krytyk, z liniami skupienia i półtonem za postaciami |
| naklejka VS i taśma WALCZ!       | na wejście                                           |
| BUM! i natryskiwany szablon K.O. | nokaut                                               |
| tag WYGRANA!                     | wygrana Buda                                         |
| pieczęć TWÓJ REWIR               | przejęty rewir                                       |

Konfetti nie ma.

## Trening

Każda umiejętność ma własną minigrę (`Quests/TrainingGames.cs`, ekran `TrainingScreen`). Wynik 0–5 trafia do tego
samego endpointu `/v1/buds/me/training/:spotId`.

| Umiejętność          | Minigra       | Na czym polega                                                                |
| -------------------- | ------------- | ----------------------------------------------------------------------------- |
| Spryt                | Skupienie     | zatrzymaj znacznik w zielonym polu                                            |
| Walka                | Kombinacje    | wybij kolejność strzałek na czas                                              |
| Flow                 | Rytm          | trafiaj nuty na 3 torach równo z linią; fraza liczy się od 3 z 4 nut          |
| Graffiti             | Szablon       | trzymaj spray nad otworami, puszczaj nad maską (75% pokrycia, ≤ 20% zacieków) |
| Surfing              | Równowaga     | kontruj falę, żeby deska została w zielonym polu                              |
| Instynkt przetrwania | Tor przeszkód | skok nad płotkiem, ślizg pod belką                                            |

Każda minigra ma bota, który gra bezbłędnie. Używają go testy EditMode (bot wygrywa 5/5, bezczynność nie trenuje)
i demo `-buds-training-demo`.
