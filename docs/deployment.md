# Deployment

## GitHub

```bash
git add -A && git commit -m "chore: initial commit"
gh repo create Pixelpal --private --source . --push
```

Po pierwszym pushu workflowy `CI` i `Security checks` uruchomią się automatycznie.
Zalecane: Settings → Branches → ochrona `main` z wymaganymi checkami CI.

## Vercel (web)

1. Import repozytorium w Vercel.
2. **Root Directory**: `apps/web` (Vercel wykryje monorepo pnpm i `vercel.json`).
3. Zmienne środowiskowe: `NEXT_PUBLIC_API_URL` (domena z Railway), `NEXT_PUBLIC_SITE_URL`
   (docelowa domena strony — trafia do linków i tagów OG).

Status deploymentu pojawi się jako check „Vercel” przy commitach.

## Railway (API)

1. New Project → Deploy from GitHub repo.
2. Settings → **Config file path**: `apps/api/railway.json` (root directory zostaw na `/`).
3. Zmienne: `WEB_ORIGIN` (URL z Vercel), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
   `SUPABASE_JWT_SECRET`. Opcjonalnie `RATE_LIMIT_PER_MINUTE`, `CREATE_LIMIT_PER_MINUTE`.
   `PORT` ustawia Railway.
   **Bez `SUPABASE_SERVICE_ROLE_KEY` API trzyma dane w pamięci — na produkcji koniecznie ustaw.**
4. Settings → Networking → Generate Domain; wpisz go jako `NEXT_PUBLIC_API_URL` w Vercel.

## Supabase

1. supabase.com → **New project** (np. `buds`, region **Central EU (Frankfurt)**, zapisz hasło do bazy).
2. Migracje (CLI nie trzeba instalować — `pnpm dlx` pobiera je na chwilę), z katalogu głównego repo:

   ```bash
   pnpm dlx supabase login
   pnpm dlx supabase link --project-ref <ref>   # ref = część adresu https://<ref>.supabase.co, pyta o hasło do bazy
   pnpm dlx supabase db push                     # wysyła wszystkie migracje z supabase/migrations
   ```

   Po każdej nowej migracji w repo wystarczy ponownie `pnpm dlx supabase db push`.

3. Klucze (Project Settings):
   - **Data API / API** → Project URL → `SUPABASE_URL` — sam adres `https://<ref>.supabase.co`, **bez** `/rest/v1/`
     (z tą końcówką każde zapytanie kończy się błędem `PGRST125`),
   - **API Keys** → klucz **secret** (`sb_secret_…`; w starszych projektach `service_role`) → `SUPABASE_SERVICE_ROLE_KEY`,
   - **JWT Keys** → *Legacy JWT secret* → `SUPABASE_JWT_SECRET`.

   Lokalnie wpisz je do pliku `.env` w katalogu głównym (jest w `.gitignore`), na produkcji do zmiennych w Railway.
   Klucz secret daje pełny dostęp do bazy: **nigdy** nie wpisuj go do zmiennych `NEXT_PUBLIC_*`, do gry ani do repo.

4. Sprawdzenie: `pnpm dev` nie wypisuje ostrzeżenia „kept in memory”, a Bud stworzony na stronie pojawia się w
   Table Editor → `buds`.

## Gra (Unity → Google Play)

1. W `apps/unity` ustaw adres produkcyjnego API: `PlayerSession.DefaultApiBaseUrl`
   (`Assets/Buds/Scripts/Runtime/Core/PlayerSession.cs`) — musi być HTTPS.
2. Build: menu **Buds → Build → Android APK (dev)** albo w trybie wsadowym
   `-executeMethod Buds.EditorTools.BudsBuild.AndroidDev`.
3. Do Google Play potrzebny będzie build release (AAB) podpisany własnym keystore — dodamy go
   przed pierwszą publikacją. iOS wymaga Maca z Xcode albo Unity Build Automation.
