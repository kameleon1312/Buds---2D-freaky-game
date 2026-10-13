# Buds — roadmap

Kierunek: darmowa gra mobilna (free-to-play) z kosmetykami i wyposażeniem do zdobycia lub kupienia,
kilkoma dzielnicami i docelowo trybem multiplayer. Ten plik mówi, **co robimy po kolei i dlaczego**.

## Zasady, które obowiązują od teraz

- **Serwer jest jedynym źródłem prawdy.** XP, monety, gemy i posiadane przedmioty przyznaje tylko API.
  Gra zgłasza zdarzenia („pokonałem przeciwnika”), serwer je sprawdza. To przygotowanie pod multiplayer
  i ochrona przed oszustwami w sklepie.
- **Bez pay-to-win.** Za prawdziwe pieniądze sprzedajemy wygląd (postacie, stroje, czapki, emotki) i wygodę,
  nie przewagę w walce. Broń z płatnych zestawów to warianty wizualne lub boczne ulepszenia, nie silniejsze statystyki.
- **Dwie waluty:** `coins` (zarabiane w grze) i `gems` (kupowane). Ceny w katalogu, nigdy w kliencie.
- **Katalog jest jeden:** `packages/shared/src/catalog.ts`. Strona, API i gra czytają z niego (gra przez `GET /v1/catalog`).

## Co już jest (bufor pod monetyzację, dzielnice i multiplayer)

| Obszar                                                                                                     | Gdzie                                                    | Stan              |
| ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ----------------- |
| Katalog przedmiotów (rodzaje, rzadkości z design systemu, waluty, premium, sloty „wkrótce”)                | `packages/shared/src/catalog.ts`                         | gotowe            |
| Blokada: API odrzuca wygląd z nieposiadanym przedmiotem                                                    | `lockedItems`, `POST /v1/buds`                           | gotowe, z testem  |
| Posiadane przedmioty, portfel, paragony ze sklepów (RLS, tylko serwer)                                     | `supabase/migrations/20261013000000_items_and_store.sql` | tabele gotowe     |
| `GET /v1/catalog`, `GET /v1/buds/me/items`                                                                 | `apps/api`                                               | gotowe, z testami |
| Rejestr 4 dzielnic (Miasto Ziomków otwarte, reszta „wkrótce” z progiem poziomu), opis: `docs/districts.md` | `packages/shared/src/districts.ts`, `Districts.cs`       | gotowe            |
| Wyjścia z mapy startowej prowadzą do 3 pozostałych dzielnic (komunikat „w budowie”)                        | `Village.cs`, `GameBootstrap`                            | gotowe            |

## Kolejność prac

1. ~~Mapy 4 dzielnic~~ (`docs/districts.md`) i ~~NPC + questy z XP przyznawanym przez serwer~~ (`docs/questy.md`: 27 NPC i 29 zadań we wszystkich dzielnicach), ~~panel Buda z ekwipunkiem i umiejętnościami~~, ~~wnętrza budynków, skrytki z monetami i mapa z mgłą~~ (`docs/districts.md`, `docs/questy.md`), ~~ekwipunek od stóp do głów ze statystykami, sklep za monety i konta na stronie~~ (`docs/ekwipunek.md`). Teraz: **lista NPC i zadań od autora gry**, potem pierwsza mini-gra (freestyle / graffiti) i potyczki, w których zadziałają umiejętności.
   NPC z prostymi zadaniami (porozmawiaj, przynieś, zbierz), zgłaszanie zdarzeń do API i **XP przyznawane
   przez serwer** (`POST /v1/buds/me/events`, walidacja + limity). Pierwsza mini-gra.
2. **Ekwipunek w grze.** Ekran postaci: co mam (`/v1/buds/me/items`), co mogę założyć; zmiana wyglądu
   przez `PATCH /v1/buds/me/look` z tą samą blokadą `lockedItems`. Arkusz postaci odświeża się po zmianie.
3. **Monety i nagrody.** Portfel w API (`bud_wallets`), monety za zadania, pierwszy sklep za monety
   (stroje `common`/`uncommon`). Wszystko w transakcjach po stronie serwera.
4. **Treść pozostałych dzielnic** (mapy już są): NPC, questy i potyczki w Las Palmas, Dworze Carskim
   i Los Karkos; zapamiętywanie po stronie serwera, w której dzielnicy jest gracz (`district` przy budzie).
5. **Walka** (zgodnie z planem gry) — wtedy pojawia się kategoria `weapon` w praktyce: statystyki i balans
   po stronie serwera, w katalogu tylko wygląd i rzadkość.
6. **Konta i sklep z prawdziwymi pieniędzmi.** Logowanie (Supabase Auth: Apple/Google) i łączenie konta gościa
   (`buds.user_id` już jest), bo zakupy muszą przetrwać zmianę telefonu. Potem Unity IAP / RevenueCat,
   weryfikacja paragonów w API (`purchases`, unikalne `transaction_id`), gemy → przedmioty premium.
   Wymogi sklepów: polityka prywatności, regulamin, pokazywanie szans przy losowaniach (najlepiej ich nie mieć).
7. **Multiplayer** (patrz niżej).
8. Wydarzenia czasowe, przepustka sezonowa, kolejne dzielnice.

## Multiplayer — jak się przygotować

- **Model:** dzielnica = pokój na serwerze. Gracze w tej samej dzielnicy widzą się nawzajem, czatują
  emotkami, później grają razem w mini-gry/walki. Serwer autorytatywny (klient wysyła ruch, serwer decyduje).
- **Technologia (propozycja):** [Colyseus](https://colyseus.io) — open source (MIT), Node/TypeScript jak reszta
  backendu, gotowe SDK do Unity, pokoje i synchronizacja stanu, darmowy przy własnym hostingu (np. Railway).
  Alternatywy: Nakama (open source, więcej gotowych funkcji społecznościowych), Photon (płatny powyżej limitu graczy).
- **Co robimy już teraz, żeby to było łatwe:** logika gry w zwykłych klasach (testowalna, do przeniesienia na
  serwer), deterministyczne mapy (`Village.Build()` daje wszystkim to samo), wszystkie zmiany stanu przez API,
  dzielnice z identyfikatorami, które staną się nazwami pokojów.

## Dalsze decyzje do podjęcia

- Ceny i paczki gemów, pierwsze przedmioty premium (tworzymy je tym samym generatorem co postacie).
- Czy walka jest PvE (przeciwnicy w dzielnicach), czy też PvP.
