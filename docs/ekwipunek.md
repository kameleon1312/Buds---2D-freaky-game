# Ekwipunek, statystyki i sklep

## Postać od stóp do głów

Każdy Bud ma osiem miejsc: **Głowa, Twarz, Tułów, Dłonie, Nogi, Stopy, Dodatek, W ręku**. W każdym mieści się
jeden przedmiot. Zakładasz w grze: panel „Twój Bud” → Ekwipunek → kliknij miejsce → wybierz przedmiot → Załóż.

## Statystyki

| Statystyka | Co robi                                                      | Limit |
| ---------- | ------------------------------------------------------------ | ----- |
| Szybkość   | +1% prędkości chodu i biegu za punkt (działa od razu w grze) | 25    |
| Pancerz    | mniej obrażeń w potyczkach (gdy wejdą walki)                 | 40    |
| Szczęście  | +1% monet ze skrytek za punkt (liczy serwer)                 | 50    |

Przedmioty mogą też dodawać poziomy umiejętności (np. Monokl: +1 Spryt). Ekwipunek dokłada najwyżej
**+2** do każdej umiejętności ponad wytrenowane poziomy. Spryt z ekwipunku wydłuża zasięg odkrywania skrytek.

## Skąd przedmioty

- **Zadania:** nagrody (deskorolka, monokl, cylinder, kurtka z naszywkami…).
- **Sklep za monety:** monety ze skrytek, kupujesz w grze (panel → Sklep). Serwer sprawdza cenę i portfel
  (`POST /v1/shop/:itemId/buy`, funkcja SQL `buy_item`).
- **Prawdziwe pieniądze (później):** tylko wygląd. Przedmiot premium nie może mieć bonusów, pilnuje tego test
  `gearProblems` w `packages/shared/src/catalog.ts`. Pierwsza zapowiedź: „Sprintery Błysk — złota edycja”.

Nazwy marek są wymyślone (Sprintery Błysk, Pancerniak, Lisie Oko…). Nie używamy prawdziwych marek bez licencji.

## Jak dodać przedmiot

1. W `packages/shared/src/catalog.ts` dopisz wpis: `id`, `name`, `rarity`, cena w monetach, `slot`,
   `bonus` (`speed`, `armor`, `luck`, `skills`), `shop: true` jeśli ma być w sklepie, krótki `description`.
2. Narysuj ikonę w `tools/world/art/icons.ts` (64×64).
3. Z katalogu `apps/api`: `pnpm exec tsx ../../tools/world/export-art.ts` i
   `pnpm exec tsx ../../tools/world/export-quests.ts` (sprawdza zasady i zapisuje dane dla gry).

## Technicznie

- Wzór statystyk: `characterStats` w `packages/shared/src/gear.ts`, lustro w Unity `Quests/Gear.cs` (zmieniaj oba).
- API: `GET /v1/buds/me/equipment`, `PUT /v1/buds/me/equipment/:slot` (`{ itemId | null }`, sprawdza posiadanie i
  miejsce), `POST /v1/shop/:itemId/buy`. Tabela `bud_equipment`, migracja `20261013110000_gear_and_shop.sql`.
- Konta: `GET /v1/account/buds` (prywatne dane Budów konta), `POST /v1/account/buds/claim` (przypisuje Buda gościa
  z tej przeglądarki), `POST /v1/account/buds/:slug/pair-code` (kod do gry z dowolnego urządzenia).
