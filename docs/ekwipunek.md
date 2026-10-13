# Ekwipunek, statystyki i sklep

## Postać od stóp do głów

Każdy Bud ma osiem miejsc: **Głowa, Twarz, Tułów, Dłonie, Nogi, Stopy, Dodatek, W ręku**. W każdym mieści się
jeden przedmiot. Zakładasz w grze: panel „Twój Bud” → Ekwipunek → kliknij miejsce → wybierz przedmiot → Załóż.

## Statystyki

| Statystyka | Co robi                                                             | Limit |
| ---------- | ------------------------------------------------------------------- | ----- |
| Atak       | mocniejsze ciosy w pojedynkach                                      | 40    |
| Szybkość   | +1% prędkości chodu i biegu za punkt, pierwszy ruch i uniki w walce | 25    |
| Pancerz    | mniej obrażeń w pojedynkach                                         | 40    |
| Szczęście  | +1% monet ze skrytek i z walk za punkt, ciosy krytyczne             | 50    |

Przedmioty mogą też dodawać poziomy umiejętności (np. Monokl: +1 Spryt). Ekwipunek dokłada najwyżej
**+2** do każdej umiejętności ponad wytrenowane poziomy. Spryt z ekwipunku wydłuża zasięg odkrywania skrytek.

## Poziomy i broń

Ponad 100 przedmiotów, od 12 do 19 w każdym miejscu, każdy z wymaganym poziomem (1–15): zakładasz i kupujesz go
dopiero od tego poziomu. Przedmioty „W ręku” to broń: jej rodzaj (kij, proca, spray, mikrofon, deska) daje
ruchy w pojedynkach (`docs/pojedynki.md`). Pełna lista: `packages/shared/src/gear-items.ts`.

W grze kafelki ekwipunku są ułożone jak na ciele: Głowa, Twarz, Tułów, Nogi i Stopy pośrodku, Dłonie z lewej,
W ręku z prawej, Dodatek przy ramieniu.

## Skąd przedmioty

- **Zadania:** nagrody (deskorolka, monokl, cylinder, kurtka z naszywkami…).
- **Pojedynki:** łup o rzadkości zależnej od rywala (bossowie: epickie i legendarne).
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
