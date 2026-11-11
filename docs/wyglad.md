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

## Detale i garderoba

Oprócz fryzury, góry, nóg i butów Bud ma pola opcjonalne (stary zapis bez nich wygląda tak samo jak wcześniej):

| Pole        | Co zmienia                                                                      |
| ----------- | ------------------------------------------------------------------------------- |
| `eyes`      | kolor tęczówki (`EYE_COLORS`)                                                   |
| `mark`      | cecha twarzy: piegi, rumieńce, pieprzyk, blizna, zarost, wąsy, broda            |
| `glasses`   | okulary, lenonki, przeciwsłoneczne, sportowe                                    |
| `print`     | nadruk na górze: paski, pas, odznaka, błyskawica, gwiazda, moro                 |
| `accessory` | łańcuch, plecak, nerka, szalik, zegarek                                         |
| `accent`    | kolor wykończeń, nadruków, czapek i dodatków; `-1` albo brak dobiera go do góry |

Każde ubranie jest narysowane w `vector.ts` ze szwami, ściągaczami, kieszeniami, zamkami i guzikami, w widoku z przodu,
z boku i z tyłu. Po zmianie generatora: `tools/export-guest-sheet.ts` (Bud gościa) i `tools/world/export-quests.ts`
(mieszkańcy i rywale). Nowe ubranie potrzebuje ikony w `tools/world/art/icons.ts` (sprawdza to `export-quests.ts`).

## Stroje miast

Mieszkańcy i przeciwnicy ubierają się jak ich miasto (`content/wardrobe.ts`, `dressed`, wołane przy składaniu
`CONTENT`). Ubrania i nakrycia głowy tylko dla nich (`CITY_OUTFITS`: koszula hawajska, bezrękawnik, bluza i suknia
ze stójką, surdut, suknia balowa; `CITY_HAIR`: słomkowy kapelusz, kapelusz, cylinder, bandana, kwiat we włosach, kok
ze szpilkami, czapka kucharska) są narysowane w `vector.ts`, ale nie ma ich w katalogu, więc serwer odrzuca wygląd
gracza, który by je nosił. Twarze są takie same dla wszystkich. Po zmianie: `tools/world/export-quests.ts`.

Kreator na stronie (`Creator.tsx`) pokazuje każdą opcję jako obrazek na tym właśnie Budzie (`BudSprite` z `crop`), ma
gotowe zestawy, obracanie, losowanie i cofanie. Kreator w grze (`CreatorScreen`) czyta te same listy z `GET /v1/look/options`.
