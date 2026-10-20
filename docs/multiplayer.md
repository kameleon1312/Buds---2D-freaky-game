# Multiplayer: inni gracze na mapie

Każdy połączony Bud (konto albo sparowany gość z tokenem) widzi na swojej mapie Budy innych graczy: jak chodzą,
biegną, jeżdżą na pojazdach, wchodzą do budynków i wołają hasła. Do każdego można podejść i wyzwać go na
pojedynek. Gracz jako gość bez parowania (bez tokenu) gra sam.

## Jak to działa

- **Jedno połączenie na urządzenie:** WebSocket `wss://<api>/v1/live`, na tym samym porcie i w tym samym procesie co
  REST API (`apps/api/src/live.ts`, biblioteka `ws`). Render obsługuje WebSockety bez zmian w `render.yaml`.
- **Pokój = mapa:** dzielnica, pustkowie, wyspa albo pokój w budynku. W pokoju mieści się `LIVE_ROOM_CAP` (40)
  Budów; kolejni trafiają do kopii (`miasto-ziomkow#2`). Zmiana mapy to wiadomość `join`, a serwer przenosi Buda
  do innego pokoju.
- **Ten sam Bud na dwóch urządzeniach:** wygrywa nowsze (stare dostaje kod 4004 i komunikat „Ten Bud gra teraz
  na innym urządzeniu”, a połączyć się próbuje dopiero po minucie).
- **Protokół** (`packages/shared/src/live.ts`, schematy zod): klient wysyła `hello` (token, mapa, pozycja),
  `move` (najwyżej co 100 ms i tylko przy zmianie, a stojąc co 1,5 s), `join`, `emote`, `chat`, `me`, `ping`.
  Serwer odpowiada `welcome` (kto już jest), `join`, `leave`, `state` (co 100 ms, tylko zmiany), `emote`, `chat`,
  `slow`, `bye`.
  Pozycje są w jednostkach świata Unity (x w prawo, y w górę, stopy).

## Bezpieczeństwo i odporność

- **Serwer nigdy nie przyznaje nagród przez WebSocket.** XP, monety, przedmioty i pojedynki zostają w REST API
  (te same atomowe funkcje SQL co wcześniej). WebSocket pokazuje tylko, gdzie kto stoi.
- **Ruch jest sprawdzany:** każda pozycja przechodzi przez siatkę chodzenia mapy (`walk-grids.ts`, generowana przez
  `tools/world/export-maps.ts` z tych samych plików map co kolizje w grze) i limit prędkości `LIVE_MAX_SPEED`. Złej
  pozycji serwer po prostu nie przekazuje dalej. Własny Bud gracza nigdy nie jest cofany, więc chodzenie zawsze jest
  płynne. Test `TheServersWalkGridsMatchTheMaps` (Unity) pilnuje, żeby serwer nie uznał za ścianę miejsca, po którym
  gra pozwala chodzić. Po zmianie mapy trzeba uruchomić `export-maps.ts` (zapisuje też siatki).
- **Limity:**
  - wiadomości: `LIVE_RATE` (20/s, chwilowo dwa razy więcej), a zalew kończy się kodem 4008;
  - wielkość wiadomości: `LIVE_MAX_MESSAGE` (1 KB);
  - połączenia z jednego adresu: `LIVE_PER_ADDRESS` (32), adres liczony jak przy limitach REST
    (`CLIENT_IP_HEADER`);
  - hasło: raz na 1,5 s; `me`: raz na 2 s;
  - pięć błędnych wiadomości z rzędu kończy połączenie kodem 4002;
  - bez `hello` w ciągu 8 s połączenie jest zamykane;
  - klient, który przestał czytać (zaległości powyżej 512 KB), jest rozłączany.
- **Kody zamknięcia** (`LIVE_CLOSE`):

  | Kod  | Znaczenie        |
  | ---- | ---------------- |
  | 4001 | brak `hello`     |
  | 4002 | błędne dane      |
  | 4003 | nieznany token   |
  | 4004 | inne urządzenie  |
  | 4005 | nieznana mapa    |
  | 4006 | za dużo połączeń |
  | 4007 | restart serwera  |
  | 4008 | zalew            |

- **Klient** (`LiveClient`, `GameBootstrap.Live.cs`):
  - Gniazdo działa na wątkach roboczych, a gra dotyka tylko dwóch kolejek.
  - Każdy błąd sieci kończy się stanem `Closed`. Gra nigdy na sieć nie czeka i nie dostaje z niej wyjątku.
  - Ponowne łączenie: 1, 2, 4, 8, 15 i 30 s (z losowym rozrzutem). Po 4003 klient próbuje znowu za 5 minut.
  - W tle aplikacja się rozłącza (inni widzą, że Bud wyszedł), a po powrocie łączy się od nowa.
  - Wylogowanie zamyka połączenie od razu.

## W grze

- **Inni gracze** (`RemoteBud`):
  - Są rysowani jak własny Bud: cień, rzucany cień, kroki według przebytej drogi, pojazd i postawa na desce.
  - Ruch jest wygładzany: pokazujemy pozycję sprzed 150 ms, a skok o ponad 4 pola jest natychmiastowy (`LiveTrack`).
  - Nie mają kolizji, więc nikt nie zablokuje ulicy.
- **Arkusze innych Budów:**
  - Gra pobiera je w skali 6 (lżejsze), najwyżej 3 naraz. Do czasu pobrania Bud wygląda jak gość.
  - Nowy wygląd (`lookVersion`) oznacza nowe pobranie.
  - API trzyma ostatnio narysowane arkusze w pamięci (`budSheetPngCached`), więc pełna mapa nie rysuje ich w kółko.
- **Nad głową:** imię, poziom oraz „w walce” albo „w menu” (`LiveUi`). Hasła pojawiają się w dymkach na 2,6 s.
- **Czat** (dymek obok panelu z poziomem i nickiem, na PC także T):
  - Okno pokazuje, co powiedziano na tej mapie (ostatnie 40 linii), osiem gotowych haseł (`EMOTES`) i pole na
    własne słowa. Wiadomość wysyła Enter albo „Wyślij”, a na telefonie „Gotowe” na klawiaturze.
  - Na przycisku czerwona liczba nieprzeczytanych wiadomości. Bez połączenia dymek jest przygaszony.
  - Słowa trafiają nad głowę Buda w dymku i do okna czatu u wszystkich na mapie, także u nadawcy. Nadawca widzi
    swoje słowa dopiero wtedy, gdy wrócą z serwera, więc zawsze tak, jak widzą je inni.
  - Serwer czyści każdą wiadomość (`packages/shared/src/chat.ts`, `cleanChat`):
    - najwyżej 80 znaków;
    - przekleństwa zamienia na gwiazdki, także pisane cyframi, z kropkami albo z odstępami między literami;
    - linki, adresy e-mail i numery telefonów zamienia na `***`;
    - usuwa znaki niewidoczne.
  - Limit tempa: 4 wiadomości na 8 s, co najmniej 0,7 s przerwy, ta sama wiadomość nie wcześniej niż po 15 s.
    Zbyt szybka wiadomość dostaje odpowiedź `slow` („Za szybko. Poczekaj chwilę.”). Gra pilnuje tego samego
    (`ChatLog.TrySend`).
  - **Wyciszanie:** dwukrotne dotknięcie wiadomości gracza wycisza go na tym urządzeniu. Znikają jego wiadomości
    i hasła, a lista zostaje zapisana. „Odcisz (N)” w nagłówku okna zdejmuje wszystkie wyciszenia.
  - Gdy okno jest otwarte, świat czeka (klawisze to litery), a nad Budem inni widzą „pisze…” (status 3).
- **Spotkanie:**
  - Kiedy podejdziesz do gracza, pojawia się „Gracz: X (poz. N) [E]”.
  - E otwiera kartę z przyciskiem „Wyzwij”. To ten sam pojedynek PvP co w Rewirach (zapisany skład rywala, liga,
    przerwa przed rewanżem) i tak samo rozstrzyga go serwer.
  - Po walce wracasz na ulicę.
- **Sprawdzanie:** dwa klienty naraz z `-buds-live-demo a` i `-buds-live-demo b` (każdy z własnym
  `-buds-pair KOD`, `-buds-api`, `-buds-district miasto-ziomkow` i `-buds-autoshot`). W logu pojawiają się linie
  `[Live]`: kto kogo widzi, ruch, karta, wejście do budynku i powrót. `-buds-offline` wyłącza tryb live.
