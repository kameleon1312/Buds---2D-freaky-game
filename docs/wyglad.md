# Wygląd Buda

Wygląd generuje wektorowo `packages/shared/src/bud/vector.ts` (jedno źródło dla strony, API i gry). Gra nigdy nie
rysuje postaci sama: pobiera arkusz z API (`/v1/buds/:slug/sheet.png`, a w kreatorze podgląd `/v1/look/sheet.png`).

## Części i katalogi

Każda część ma **standardowy katalog dla ziomka i dla ziomeczki** (`*_BY_GENDER` w `bud/constants.ts`) i własne
kolory:

| Część | Ziomek                                       | Ziomeczka                                            | Kolory |
| ----- | -------------------------------------------- | ---------------------------------------------------- | ------ |
| Włosy | 12 fryzur (m.in. Na zero, Irokez)            | 12 fryzur (m.in. Loki, Kitki)                        | 13     |
| Góra  | 9 (m.in. Flanela)                            | 9 (m.in. Sukienka)                                   | 14     |
| Nogi  | Jeansy, Dresy, Bojówki, Chinosy, Szorty      | Jeansy, Legginsy, Spódnica, Dresy, Szorty, Bojówki   | 10     |
| Buty  | Trampki, Za kostkę, Glany, Mokasyny, Sandały | Trampki, Za kostkę, Kozaki, Glany, Sandały, Mokasyny | 10     |

Do tego karnacja (8 odcieni) i nastrój (6, przymiotniki zgodne z płcią). Walidacja przyjmuje każdy fason dla każdej
płci, a kreatory pokazują katalog wybranej płci.

## Zasady

- Listy tylko **dopisujemy na końcu**: wygląd zapisuje numery kolorów i nazwy fasonów.
- Nowe pola mają wartości domyślne (`pants: 'jeansy'`, `shoes: 'trampki'`), więc stare wyglądy dalej działają.
- Po zmianie generatora: `tools/export-guest-sheet.ts` (gość w Unity) i `tools/world/export-quests.ts` (arkusze NPC
  i przeciwników).
- Tworzenie Buda w grze: `CreatorScreen` czyta opcje z `GET /v1/look/options`, podgląd renderuje serwer, a
  `POST /v1/buds` zwraca token, więc telefon jest od razu połączony.
