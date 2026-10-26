# Buds — roadmap

Kierunek: darmowa gra mobilna (free-to-play) z kosmetykami i wyposażeniem do zdobycia lub kupienia,
kilkoma dzielnicami i docelowo trybem multiplayer. Ten plik mówi, **co robimy po kolei i dlaczego**.

## Zasady, które obowiązują od teraz

- **Serwer jest jedynym źródłem prawdy.** XP, monety, gemy i posiadane przedmioty przyznaje tylko API.
  Gra zgłasza zdarzenia („pokonałem przeciwnika”), serwer je sprawdza. To przygotowanie pod multiplayer
  i ochrona przed oszustwami w sklepie.
- **Bez pay-to-win.** Za prawdziwe pieniądze sprzedajemy wygląd (postacie, stroje, czapki, emotki), wygodę i
  unikatowe pojazdy oraz bronie, które są dokładnie tak mocne jak ich odpowiedniki do zdobycia w grze (`twin`,
  najwyżej 2 poziomy wcześniej). Pilnuje tego `gearProblems`.
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

1. ~~Mapy 4 dzielnic~~ (`docs/districts.md`) i ~~NPC + questy z XP przyznawanym przez serwer~~ (`docs/questy.md`: 27 NPC i 29 zadań we wszystkich dzielnicach), ~~panel Buda z ekwipunkiem i umiejętnościami~~, ~~wnętrza budynków, skrytki z monetami i mapa z mgłą~~ (`docs/districts.md`, `docs/questy.md`), ~~ekwipunek od stóp do głów ze statystykami, sklep za monety i konta na stronie~~ (`docs/ekwipunek.md`), ~~ponad 100 przedmiotów z poziomami, pojedynki turowe z ruchami zależnymi od broni, 21 przeciwników z łupem~~ (`docs/pojedynki.md`), ~~kreator Buda w grze, Wyspa Startowa z samouczkiem, większe dzielnice z działkami pod nowe treści, nowe części i kolory wyglądu~~ (`docs/wyglad.md`, `docs/districts.md`), ~~trening umiejętności na mapie, wyjątkowe umiejętności, napoje energetyczne i pojazdy~~ (`docs/umiejetnosci.md`). Teraz: **lista NPC i zadań od autora gry**, potem pierwsza mini-gra (freestyle / graffiti) i potyczki, w których zadziałają umiejętności.
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
   weryfikacja paragonów w API (`purchases`, unikalne `transaction_id`), gemy → przedmioty premium
   (~~sklep premium za gemy: 5 pojazdów i 6 broni~~, `docs/ekwipunek.md`; zostały płatności i `grant_gems` po weryfikacji).
   Wymogi sklepów: polityka prywatności, regulamin, pokazywanie szans przy losowaniach (najlepiej ich nie mieć).
7. ~~**Multiplayer**~~ — gracze na wspólnej mapie, w czasie rzeczywistym (`docs/multiplayer.md`). Dalej: wspólne
   mini-gry, wymiana przedmiotów twarzą w twarz, walki na żywo (obie strony grają naraz).
8. **Dystrykty** (`docs/dystrykty.md`): ~~działki na pustkowiach w stylu okolicy, własny nazwany dystrykt rosnący
   wycinką kawałek po kawałku, produkcja, czynsz, budowle prestiżowe i rangi, widoczny dla wszystkich, napady od poziomu
   6 z obroną rosnącą z prestiżem~~; dalej powiadomienia o napadach i
   zemsta, budynki obronne, więcej działek, ekipy i ranking dystryktów.
9. Wydarzenia czasowe, przepustka sezonowa, kolejne dzielnice.

## Multiplayer

Jest (`docs/multiplayer.md`): mapa = pokój na serwerze (kolejne kopie, gdy pokój się zapełni), jeden WebSocket
na urządzenie w tym samym procesie co API (`apps/api/src/live.ts`, bez osobnej usługi i bez Colyseusa), ruch
sprawdzany na serwerze siatką chodzenia z map i limitem prędkości, hasła w dymkach, nazwy nad głowami, wyzwanie
na pojedynek z ulicy. Nagrody dalej wyłącznie przez REST API. Gdy graczy będzie tylu, że jeden proces nie wystarczy:
pokoje na kilku instancjach (klucz pokoju = mapa, łatwy podział) i Redis do wspólnego stanu połączeń.

## Dalsze decyzje do podjęcia

- Ceny i paczki gemów, pierwsze przedmioty premium (tworzymy je tym samym generatorem co postacie).
- Czy walka jest PvE (przeciwnicy w dzielnicach), czy też PvP.
