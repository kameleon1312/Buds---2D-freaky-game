# Buds — dzielnice

Świat Buds składa się z 4 dzielnic. Każda to **duża mapa**: miasto w centrum plus otwarte okolice do zwiedzania,
gdzie zdobywa się XP w questach i potyczkach. Każda dzielnica ma własny klimat, własną mechanikę i własne
kosmetyki w sklepie. W multiplayerze dzielnica = osobny pokój na serwerze.

Rejestr (nazwy, progi poziomu, status): `packages/shared/src/districts.ts`, lustro w Unity: `Districts.cs`.

| #   | Dzielnica          | Wejście od poziomu | Klimat                      | Główna mechanika                                              |
| --- | ------------------ | ------------------ | --------------------------- | ------------------------------------------------------------- |
| 1   | **Miasto Ziomków** | start              | codzienne życie, ulica      | freestyle, graffiti i ukrywanie się przed policją             |
| 2   | **Las Palmos**     | 4                  | tropiki, plaże, ocean       | eksploracja, zwierzęta, zadania na wodzie                     |
| 3   | **Dwór Carski**    | 8                  | arystokracja, cegła, dworek | zagadki logiczne, okradanie nieuczciwych urzędników           |
| 4   | **Los Karkos**     | 12                 | bieda, ruiny, graffiti      | ciągłe zaczepki, trening walki i przetrwania, sklepy z bronią |

Kolejność progów rośnie z trudnością: Miasto Ziomków uczy podstaw, Las Palmos to spokojna eksploracja,
Dwór Carski wymaga myślenia i pierwszych walk, Los Karkos to sprawdzian dla doświadczonych.

## Wspólny układ mapy

- **Rozmiar:** ok. 128 × 96 pól (dzisiejsza mapa startowa ma 48 × 36).
- **Centrum (miasto):** ok. 50 × 40 pól — budynki, sklepy, NPC z questami, bezpieczne (poza Los Karkos).
- **Okolice:** 3–4 strefy wokół centrum, każda z własnym typem questów i przeciwników; im dalej od centrum,
  tym trudniej i lepsze nagrody.
- **Drogi:** Miasto Ziomków jest węzłem — prowadzą z niego drogi do pozostałych trzech dzielnic
  (północ → Las Palmos, południe → Dwór Carski, wschód → Los Karkos).
- **Punkt odrodzenia:** przegrana walka = powrót do centrum dzielnicy (pierwszy raz — Miasto Ziomków).

## 1. Miasto Ziomków (start)

**Klimat:** zwykłe miasto i zwykłe życie: kamienice i bloki, sklepiki, park, przystanek, boisko, skatepark.
Tu każdy nowy gracz pojawia się po raz pierwszy.

**Centrum:**

- Rynek z tablicą ogłoszeń (questy dnia), sklep z ciuchami, fryzjer (zmiana fryzury), kiosk, kawiarnia.
- Skatepark i boisko — miejsca spotkań graczy (w multiplayerze).

**Okolice:**

- **Podwórka i garaże** — pierwsze bitwy freestylowe z lokalnymi raperami.
- **Tory i wiadukt** — ściany pod graffiti, patrole policji.
- **Działki i park za miastem** — spokojne questy (znajdź, przynieś, pomóż), zbieranie.

**Questy:** pomoc mieszkańcom (zakupy dla sąsiadki, zgubiony pies, naprawa roweru), samouczek ruchu i rozmów,
pierwsze zlecenia graffiti.

**Potyczki:**

- **Bitwy freestylowe** — mini-gra rytmiczna (trafiaj w takt, dobieraj rymy); wygrana = XP i szacun.
- **Graffiti** — mini-gra: maluj, zanim zauważy cię patrol. **Policjanci patrolują trasy** i mają
  pole widzenia (stożek); złapanie = utrata części nagrody i ucieczka do centrum.

**Sklepy:** ciuchy (stroje `common`), farby do graffiti, przekąski (leczenie).

**Kosmetyki premium:** kolekcja „Street” — kurtki, czapki, buty, wzory farby do graffiti, emotki z freestyle'u.

**Grafika do zrobienia:** bloki i kamienice, sklepy z szyldami, ławki, latarnie, przystanek, skatepark,
boisko, wiadukt, ściany pod graffiti (z rysowanym wzorem), radiowóz, policjant (postać NPC), raperzy.

## 2. Las Palmos (poziom 4)

**Klimat:** tropiki — palmy, plaże, turkusowy ocean, hawajskie chatki na palach, kwiaty, egzotyczne zwierzęta.
Najbardziej kolorowa i najspokojniejsza dzielnica.

**Centrum:** miasteczko z hawajskimi domkami, targ owoców, bar na plaży, wypożyczalnia desek, port rybacki.

**Okolice:**

- **Plaże i rafa** — zbieranie muszli, nurkowanie (mini-gra), surfing (mini-gra zręcznościowa).
- **Dżungla** — ścieżki, wodospad, ruiny świątyni z zagadkami.
- **Wulkan / klify** — najdalsza i najtrudniejsza strefa.

**Zwierzęta:** papugi, żółwie, kraby, małpki (podkradają przedmioty), flamingi, delfiny w oceanie.
Część to towarzysze do oswojenia (questy), część — przeciwnicy (zdenerwowane kraby, dzikie małpy).

**Questy:** eksploracja i zbieranie (mapa skarbów, zaginione łodzie), pomoc zwierzętom, wyścigi na deskach.

**Potyczki:** lekkie — przepędzanie małpich band, pojedynki surfingowe, starcia z przemytnikami na klifach.

**Sklepy:** stroje plażowe, deski, przynęty i sprzęt do nurkowania.

**Kosmetyki premium:** kolekcja „Aloha” — hawajskie koszule, wianki, okulary, deski surfingowe,
zwierzak-towarzysz (papuga na ramieniu).

**Grafika do zrobienia:** palmy (kilka wariantów), piasek i ocean z falą przy brzegu, chatki na palach,
pomost, łodzie, stragany z owocami, kwiaty tropikalne, zwierzęta (z animacją), wodospad, ruiny.

## 3. Dwór Carski (poziom 8)

**Klimat:** arystokracja i przepych — ceglane kamienice, brukowane ulice, latarnie gazowe, ogrody
z żywopłotami, a w centrum wielki dworek. Za fasadą — nieuczciwi urzędnicy.

**Centrum:** dworek (najważniejszy budynek dzielnicy, wnętrze z zagadkami), urząd, bank, opera, ogród różany
z labiryntem z żywopłotu.

**Okolice:**

- **Labirynt ogrodowy** — zagadki przestrzenne.
- **Dzielnica urzędnicza** — tu kręcą się ludzie w cylindrach.
- **Stare stajnie i powozownia** — zadania śledcze.

**Questy:** **dużo questów logicznych** — szyfry, zagadki, układanki, śledztwa („kto podmienił testament?”),
dyplomacja (dobór odpowiedzi w rozmowie). Nagrody: XP i wpływy.

**Potyczki:** starcia z **urzędnikami w cylindrach** — nieuczciwymi biurokratami. Po wygranej można ich
**okraść z pieniędzy** (monety z ich nieuczciwych interesów). Im ważniejszy urzędnik, tym silniejsza ochrona
i większy łup. Kradzież podnosi „poszukiwanie” — straż dworska zaczyna patrolować okolicę.

**Sklepy:** stroje wieczorowe, laski, zegarki kieszonkowe, wejściówki do opery (dostęp do questów).

**Kosmetyki premium:** kolekcja „Carska” — fraki, cylindry, monokle, suknie balowe, złote dodatki.

**Grafika do zrobienia:** ceglane kamienice, dworek (duży, z detalami), bruk, latarnie gazowe, żywopłoty
i fontanny, powozy, urzędnicy w cylindrach (NPC/przeciwnicy), straż dworska, sejf i worki z monetami.

## 4. Los Karkos (poziom 12)

**Klimat:** niebezpiecznie — bieda, zaniedbane ulice, w centrum opuszczone budynki pokryte graffiti,
płoty z siatki, wraki aut, beczki z ogniem. Fikcyjne miejsce: zło to konkretne gangi i typy spod ciemnej
gwiazdy, nie mieszkańcy jako tacy — są tu też NPC, którym warto pomóc.

**Centrum:** opuszczone bloki z graffiti, dziki bazar, **sklepy z bronią** (wyposażenie na dalsze misje),
siłownia i ring.

**Okolice:**

- **Złomowisko** — zbieranie części, craft.
- **Kanały i tunele** — ciasne przejścia, zasadzki.
- **Stara fabryka** — siedziba gangu, zadanie końcowe dzielnicy.

**Mechanika — zaczepki:** **nieprzyjemne typy zaczepiają cię w każdej chwili** (losowe spotkania w ruchu).
Trzeba być ostrożnym: unikać ich wzroku, wybierać ciemne zaułki albo się bić. **Instynkt przetrwania** —
statystyka, która rośnie z każdą unikniętą zasadzką (wcześniej widzisz zagrożenie).

**Questy:** trening walki (ring, siłownia), przetrwanie (dojdź z punktu A do B bez walki), pomoc lokalnym
(odzyskaj skradziony towar), rozbicie gangu.

**Potyczki:** najtrudniejsze w grze — grupy przeciwników, zasadzki, bossowie gangów. Tutaj **trenujesz
umiejętności walki**, które przydają się we wszystkich dzielnicach.

**Sklepy:** **broń** (kije, kastety, procarki — kupowane za monety, z ulepszeniami), apteczki, ochraniacze.
Statystyki broni ustala serwer; w sklepie premium tylko wygląd broni (bez pay-to-win).

**Kosmetyki premium:** kolekcja „Karkos” — kurtki z naszywkami, kominiarki, skórki broni, efekty graffiti.

**Grafika do zrobienia:** zrujnowane bloki z graffiti, siatki i drut, wraki aut, beczki z ogniem, śmieci,
bazar z budami, ring, siłownia, złomowisko, wejścia do kanałów, zbiry (kilka typów), boss gangu.

## Systemy wspólne dla dzielnic (do zaprojektowania przy budowie)

- **Walka** — prosta, czytelna na telefonie (np. ataki z czasem odnowienia + unik). Statystyki po stronie serwera.
- **Mini-gry** — freestyle (rytm), graffiti (skradanie + malowanie), surfing/nurkowanie, zagadki.
- **NPC i questy** — dane questów w jednym formacie (cel, warunki, nagroda) czytane przez grę i walidowane przez API.
- **Patrole i pole widzenia** — policja (Miasto Ziomków), straż dworska (Dwór Carski), gangi (Los Karkos).
- **Ekonomia** — monety z questów, walk i (w Dworze Carskim) z okradania urzędników; wszystko przyznaje serwer.
