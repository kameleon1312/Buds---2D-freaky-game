# NPC i questy

Wszystkie postacie niezależne (NPC) i zadania są danymi w jednym pliku na dzielnicę:
`packages/shared/src/content/<dzielnica>.ts` — `miasto-ziomkow.ts`, `las-palmas.ts`, `dwor-carski.ts`, `los-karkos.ts`
(27 NPC, 29 zadań, ok. 6500 XP; zadania z każdej dzielnicy dają poziom potrzebny do wejścia do następnej: 3 → 5 → 7). Z tych danych korzystają:

- **gra** — dostaje je jako `apps/unity/Assets/Buds/Resources/Quests/content.json` + wygląd NPC jako arkusze PNG,
- **serwer** — sprawdza przy oddawaniu zadania, czy istnieje, czy spełnione są wymagania i poziom, i **tylko on przyznaje XP**
  (raz na zadanie, w jednej transakcji: `POST /v1/buds/me/quests/:id/complete`).

## Jak działa zadanie w grze

1. NPC ze złotym **„!”** nad głową ma dla ciebie zadanie. Podchodzisz, **E** (albo dotknięcie), czytasz opis i nagrodę,
   wybierasz **Przyjmij** / **Później**.
2. Kroki wykonują się po kolei; aktualny cel widać w panelu po prawej:
   - **porozmawiaj** z NPC (ma wtedy zielony **„?”**),
   - **idź do** miejsca (złoty pulsujący krąg na ziemi),
   - **zbierz** przedmioty (leżą na mapie tylko w trakcie zadania).
3. Wracasz do zleceniodawcy (zielony **„?”**) i oddajesz zadanie: serwer dopisuje XP, pasek rośnie, przy nowym
   poziomie pojawia się „Awans!”. Szary **„…”** = zadanie od tego NPC jest w toku.

Postęp w trakcie zadania zapisuje się na urządzeniu; ukończone zadania są zapisane na serwerze. W trybie gościa
zadania działają, ale XP się nie zapisuje (gra o tym mówi).

## Nagrody i panel Buda

- Zadanie może dawać **przedmiot** (`rewardItem`, z katalogu `packages/shared/src/catalog.ts`) — serwer dopisuje go do
  ekwipunku razem z XP.
- **Panel „Twój Bud”** (przycisk pod HUD-em albo `I` / `Tab` / `C`): _Profil_ (poziom, XP, zadania, dzielnice,
  portfel), _Ekwipunek_ (co masz na sobie + zdobyte przedmioty w ramkach w kolorze rzadkości), _Umiejętności_.
- **Umiejętności** (`packages/shared/src/skills.ts`): 6 umiejętności po 5 poziomów; każdy poziom postaci daje punkt,
  który wydaje się w panelu — serwer pilnuje, żeby nie wydać więcej, niż się ma
  (`POST /v1/buds/me/skills/:id/upgrade`). Działanie umiejętności podłączymy do walk i mini-gier.

## Jak przekazać własną listę

Wystarczy opis w takiej formie (resztę — współrzędne na mapie, wygląd, teksty techniczne — uzupełnię):

```
NPC: Pani Halina
- gdzie: Rynek, przy fontannie
- wygląd: starsza pani, siwy kok, kurtka w kolorze pomarańczowym, spokojna (nastrój: wyluzowany)
- mówi na co dzień: „Za moich czasów to się chodziło piechotą!”

Zadanie: Zakupy dla sąsiadki
- daje: Pani Halina
- wymaga: poziomu 1, wcześniej zadania „Witaj w mieście”
- opis (gdy proponuje): „Upuściłam siatki z zakupami…”
- kroki: zbierz 3 siatki z zakupami w okolicy rynku
- po oddaniu mówi: „Wszystko jest! Złote z ciebie dziecko.”
- nagroda: 50 XP
```

Rodzaje kroków, które gra już obsługuje: **porozmawiaj z X**, **idź do miejsca**, **zbierz N przedmiotów**.
Kolejne (np. walka, mini-gra freestyle, graffiti, przynieś przedmiot z ekwipunku) dojdą razem z tymi systemami.

## Technicznie (dla programisty)

- Schemat i reguły: `packages/shared/src/quests.ts` (`npcSchema`, `questSchema`, `questBlocker`, `contentProblems`).
- Po zmianie treści: z katalogu `apps/api` uruchom `pnpm exec tsx ../../tools/world/export-quests.ts` — skrypt
  sprawdza, czy każdy NPC stoi na wolnym polu i nie blokuje przejścia, a cele i przedmioty są osiągalne, potem
  zapisuje JSON i arkusze NPC. Nowy przedmiot do zbierania potrzebuje grafiki `item-<nazwa>` w `tools/world/art/quest.ts`.
- Testy: `packages/shared/test/quests.test.ts`, `apps/api/test/buds.test.ts` (quests), Unity `QuestTests.cs`.
