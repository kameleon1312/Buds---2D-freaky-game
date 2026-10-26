# Podróże: pustkowia, zasadzki i promy

## Pustkowia między miastami

Każda droga z Miasta Ziomków prowadzi przez pustkowie do następnego miasta (`packages/shared/src/travel.ts`
`ROUTES`, mapy z `tools/world/maps/routes.ts`, 150×96 pól; po obu stronach drogi leżą działki pod dystrykty graczy,
`docs/dystrykty.md`):

| Trasa           | Między                          | Krajobraz                         | Poziomy zasadzek            |
| --------------- | ------------------------------- | --------------------------------- | --------------------------- |
| Leśne Ostępy    | Dzika Puszcza ↔ Miasto (zachód) | łąki, zagajniki, krzaki           | 2–5                         |
| Wydmy           | Las Palmas ↔ Miasto (północ)    | piasek, suche trawy, palmy        | 3–7                         |
| Stary Gościniec | Miasto ↔ Dwór Carski (południe) | pola, sady, żywopłoty, żwir       | 4–8                         |
| Nieużytki       | Miasto ↔ Los Karkos (wschód)    | gruz, złom, martwe drzewa, asfalt | 6–12 (Wielki Zbyszek, boss) |

Wejście na trasę wymaga poziomu miasta na jej drugim końcu (`canEnterRoute`); powrót do domu jest zawsze otwarty.
Miasto i jego pustkowia są połączone bez wczytywania (`World/Seams`, `GameBootstrap.Seam.cs`):

- Gdy Bud zbliża się do drogi wyjazdowej (48 pól), pustkowie liczy się w tle na wątku roboczym.
- Od 36 pól pustkowie jest układane tuż za krawędzią miasta, po kilka milisekund na klatkę, więc Bud widzi je przed sobą.
- Granice obu map otwierają się na szerokość drogi.
- W chwili przekroczenia granicy cały świat przesuwa się tak, żeby pustkowie leżało w zerze. Gracz tego nie widzi, a
  współrzędne map zostają takie, jakich oczekują serwer, zadania i multiplayer.
- Wchodzą ludzie pustkowia, a nastrój kolorystyczny przechodzi płynnie w ciągu 4 s. Miasto zostaje za plecami jako
  widok, dopóki Bud nie odejdzie na 70 pól.
- Powrót do miasta jest tak samo płynny. Efekt przejścia zostaje tylko na drugim końcu pustkowia, przy wejściu do nowego
  miasta.
- Końcówki pustkowi przejmują nawierzchnię miasta (asfalt, chodniki, trawa) i przez 12 rzędów przechodzą w ich własny
  teren (`routes.ts`, `meetCity`).
- Jeśli mapy nie dałoby się ułożyć obok siebie, droga po 3 s wraca do starego przejścia z wyciemnieniem.
- Gdy Bud jest w budynku, jego dzielnica czeka wyłączona w pamięci, więc wyjście z budynku trwa milisekundy zamiast
  ponad sekundy.

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
