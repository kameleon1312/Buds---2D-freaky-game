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
3. Zmienne środowiskowe:
   - `NEXT_PUBLIC_API_URL` — domena API z Railway (`https://…up.railway.app`),
   - `NEXT_PUBLIC_SITE_URL` — adres strony (najpierw `https://<projekt>.vercel.app`, potem twoja domena),
   - `NEXT_PUBLIC_SUPABASE_URL` i `NEXT_PUBLIC_SUPABASE_ANON_KEY` — te same publiczne wartości co w `.env`
     (bez nich konta na stronie są wyłączone). Klucza secret tu **nie** wpisuj.
4. Po zmianie zmiennych w Vercel: Deployments → **Redeploy** (zmienne `NEXT_PUBLIC_*` są wklejane w kod przy budowaniu).

Status deploymentu pojawi się jako check „Vercel” przy commitach.

### Własna domena (później)

1. Vercel → projekt → Settings → **Domains** → dodaj domenę i ustaw u rejestratora rekordy DNS, które pokaże Vercel.
2. Zmień adres strony wszędzie, gdzie występuje: `NEXT_PUBLIC_SITE_URL` (Vercel, potem Redeploy), `WEB_ORIGIN`
   (Railway — inaczej przeglądarka zablokuje zapytania do API przez CORS) i w Supabase → Authentication → URL
   Configuration (Site URL i Redirect URLs `…/konto`, `…/konto/nowe-haslo`).
3. Opcjonalnie domena dla API (np. `api.twojadomena.pl`) w Railway → Networking → Custom Domain; wtedy zmień
   `NEXT_PUBLIC_API_URL` w Vercel i adres w grze (`PlayerSession.DefaultApiBaseUrl`).

### Lokalnie: zmienne strony

Po dopisaniu albo zmianie `NEXT_PUBLIC_*` w `.env` zatrzymaj `pnpm dev` i uruchom go ponownie — strona wczytuje je przy
starcie. Jeśli `/konto` dalej pisze „Konta są wyłączone”, usuń `apps/web/.next` i uruchom ponownie.

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
   - **JWT Keys** → _Legacy JWT secret_ → `SUPABASE_JWT_SECRET`.

   Lokalnie wpisz je do pliku `.env` w katalogu głównym (jest w `.gitignore`), na produkcji do zmiennych w Railway.
   Klucz secret daje pełny dostęp do bazy: **nigdy** nie wpisuj go do zmiennych `NEXT_PUBLIC_*`, do gry ani do repo.

4. Konta graczy (logowanie e-mailem i hasłem), w panelu Supabase:
   - **Authentication → Sign In / Providers → Email:** włączone, z potwierdzaniem adresu e-mail;
   - **Authentication → URL Configuration:** Site URL = adres strony (lokalnie `http://localhost:3000`), a w
     Redirect URLs dodaj `http://localhost:3000/konto`, `http://localhost:3000/konto/nowe-haslo` i to samo dla
     domeny produkcyjnej;
   - **Project Settings → API Keys:** klucz **publishable** (`sb_publishable_…`, w starszych projektach `anon`)
     → `NEXT_PUBLIC_SUPABASE_ANON_KEY`, a Project URL → `NEXT_PUBLIC_SUPABASE_URL`. Te dwa są publiczne z założenia
     (trafiają do przeglądarki), lokalnie w głównym `.env`, na produkcji w Vercel.
     API sprawdza tokeny kont kluczami publicznymi projektu (JWKS), więc nic więcej nie trzeba ustawiać.

5. Sprawdzenie: `pnpm dev` nie wypisuje ostrzeżenia „kept in memory”, a Bud stworzony na stronie pojawia się w
   Table Editor → `buds`.

## Gra (Unity → Google Play)

1. W `apps/unity` ustaw adres produkcyjnego API: `PlayerSession.DefaultApiBaseUrl`
   (`Assets/Buds/Scripts/Runtime/Core/PlayerSession.cs`) — musi być HTTPS.
2. Build: menu **Buds → Build → Android APK (dev)** albo w trybie wsadowym
   `-executeMethod Buds.EditorTools.BudsBuild.AndroidDev`.
3. Do Google Play potrzebny będzie build release (AAB) podpisany własnym keystore — dodamy go
   przed pierwszą publikacją. iOS wymaga Maca z Xcode albo Unity Build Automation.
