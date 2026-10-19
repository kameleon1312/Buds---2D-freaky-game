# Podróże: pustkowia, zasadzki i promy

## Pustkowia między miastami

Każda droga z Miasta Ziomków prowadzi przez pustkowie do następnego miasta (`packages/shared/src/travel.ts`
`ROUTES`, mapy z `tools/world/maps/routes.ts`, 150×48 pól):

| Trasa           | Między                          | Krajobraz                         | Poziomy zasadzek            |
| --------------- | ------------------------------- | --------------------------------- | --------------------------- |
| Leśne Ostępy    | Dzika Puszcza ↔ Miasto (zachód) | łąki, zagajniki, krzaki           | 2–5                         |
| Wydmy           | Las Palmas ↔ Miasto (północ)    | piasek, suche trawy, palmy        | 3–7                         |
| Stary Gościniec | Miasto ↔ Dwór Carski (południe) | pola, sady, żywopłoty, żwir       | 4–8                         |
| Nieużytki       | Miasto ↔ Los Karkos (wschód)    | gruz, złom, martwe drzewa, asfalt | 6–12 (Wielki Zbyszek, boss) |

Wejście na trasę wymaga poziomu miasta na jej drugim końcu (`canEnterRoute`); powrót do domu jest zawsze otwarty.
Gdy Bud zbliża się do wyjścia (26 pól), następna mapa liczy się w tle (`WorldView.Prepare`, wątek roboczy), więc
przejście trwa ułamek sekundy zamiast kilku.

## Zasadzki

Przeciwnicy z `content/routes.ts` mają `ambush: true` i stoją w kryjówkach (pierścień krzaków, skał albo złomu z
jednym wejściem od strony drogi), które generator wycina dokładnie w ich miejscach. Są niewidoczni, dopóki Bud nie
podejdzie na `Ambush.SpringRadius` (2,4 pola): wyskakują, mówią swoje i po chwili sami zaczynają pojedynek (ten sam
`POST /v1/fights`, serwer liczy wszystko jak zawsze). Z walki można uciec; uciekinier dostaje spokój na
`Ambush.Cooldown` sekund. Trzymając się drogi, nikogo się nie spotka.

## Promy

W każdym mieście stoi przewoźnik w porcie (`PORTS`): rozmowa otwiera rozkład rejsów (`FerryScreen`). Bilet:
`10 + 3 × poziom wejścia do miasta docelowego` monet (13–31). `POST /v1/buds/me/ferry { from, to }` sprawdza porty i
poziom celu, a opłatę pobiera atomowo (`pay_fare`, migracja `20261019000000_ferry.sql`), nigdy poniżej zera. Bud
wysiada obok przewoźnika w porcie docelowym.

## Sprawdzanie

```bash
Buds.exe -buds-pair KOD -buds-api http://localhost:4000 -buds-travel-demo -buds-mobile -buds-autoshot <dir>
```

Demo idzie z miasta na Wydmy, wpada w zasadzkę i ucieka, dochodzi do Las Palmas i wraca promem. Log `[Load]` mówi,
czy mapa była przygotowana wcześniej (`ready`), czy budowana na miejscu (`now`).
