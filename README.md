# Buds

Mobilne RPG 2D z widokiem z góry. Na stronie tworzysz swojego Buda (ziomka albo ziomeczkę z
własnym nastrojem i stylem), łączysz go z grą 6-znakowym kodem i grasz: mapa, zadania od
mieszkańców, walka, mini-gry, zbieranie i craft.

## Struktura

| Ścieżka           | Opis                                                          |
| ----------------- | ------------------------------------------------------------- |
| `apps/unity`      | Gra (Unity 6.6, URP 2D) — Android/iOS                         |
| `apps/web`        | Strona: kreator Buda, profil z kodem do gry, ranking (Vercel) |
| `apps/api`        | API: Budy, tokeny graczy, parowanie, arkusze PNG (Railway)    |
| `packages/shared` | Generator wyglądu Budów, krzywa poziomów, schematy zod        |
| `supabase`        | Migracje bazy                                                 |
| `tools`           | Skrypty pomocnicze                                            |

## Start lokalnie

```bash
cp .env.example .env
pnpm install
pnpm dev                       # strona: http://localhost:3000, API: http://localhost:4000
```

Gra: otwórz `apps/unity` w Unity Hub (Unity 6.6) i uruchom scenę `Assets/Buds/Scenes/Main.unity`.
Stwórz Buda na stronie, kliknij „Pokaż kod do gry” i wpisz kod w grze — albo wybierz „Graj gościem”.

Na telefonie w tej samej sieci Wi-Fi: w buildzie deweloperskim na dole ekranu łączenia wpisz adres
API z IP komputera, np. `http://192.168.1.10:4000`.

Szczegóły: [docs/architecture.md](docs/architecture.md), [docs/deployment.md](docs/deployment.md).
