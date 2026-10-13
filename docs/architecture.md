# Architektura

```
            ┌──────────── apps/web (Vercel) ────────────┐
Gracz ────► │ kreator Buda → POST /v1/buds → token gościa│
            │ profil Buda → POST /v1/buds/me/pair-code   │
            └──────────────────────┬─────────────────────┘
                                   ▼
                        apps/api (Railway, Hono) ──► Supabase Postgres
                                   ▲                  (buds, bud_tokens, bud_pair_codes)
            ┌──────────────────────┴─────────────────────┐
Gracz ────► │ apps/unity: wpisuje kod → POST /v1/pair    │
            │ → własny token → GET /v1/buds/me           │
            │ → GET /v1/buds/:slug/sheet.png (sprite)    │
            └────────────────────────────────────────────┘
```

## Wygląd Buda

- `packages/shared/src/bud/vector.ts` rysuje postać wektorowo (SVG, styl chibi z konturem):
  kierunki przód/bok/tył, 3 klatki chodu. Opcje: płeć, 6 nastrojów (twarze), 6 karnacji, 10 fryzur, 9 kolorów włosów,
  4 stroje × 8 kolorów, 4 kolory spodni.
- Baza trzyma tylko `look` (jsonb). Strona rysuje SVG, API rasteryzuje je do PNG (resvg, 128×192 px na klatkę) dla gry. Gra nigdy nie
  ma własnej kopii generatora, dzięki czemu Bud wygląda identycznie wszędzie.

## Konta

- Na start konto gościa: losowy token (32 bajty) zwracany raz, w bazie tylko `sha256`.
- Jeden Bud może mieć wiele tokenów (przeglądarka, telefon). Nowe urządzenie dostaje token przez
  jednorazowy kod parowania (6 znaków, ważny 10 min, endpoint z limitem 5 prób/min na IP).
- Kolumna `buds.user_id` czeka na logowanie e-mail/Google (kolejny etap).

## Gra (Unity)

- Jedna scena (`Main.unity`): kamera z `PixelCamera` (całkowity zoom, 1 kafelek = 16 px) i
  `GameBootstrap`, który buduje resztę w kodzie: świat z Tilemap (`Village`, `TileArt`),
  postać (`BudController`, `BudSheet`), UI (`GameUi`, uGUI).
- Sterowanie: WASD/strzałki + E, na telefonie pływający joystick (przeciągnij) i tapnięcie = akcja.
- Tryb gościa działa offline (wbudowany arkusz `Resources/Sheets/guest.png`).
- `-buds-autoshot <dir>` uruchamia autopilota: chodzi, otwiera dialog, robi zrzuty ekranu, kończy.

## Zasady na przyszłość

- XP i nagrody przyznaje wyłącznie serwer. Gra zgłasza zdarzenia (np. „ukończono zadanie X”),
  API sprawdza warunki i limity czasowe.
- Krzywa poziomów: `packages/shared/src/level.ts` ↔ `Progression.cs`.
