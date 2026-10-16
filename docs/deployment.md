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
   - `NEXT_PUBLIC_API_URL` — adres API z Render (`https://…onrender.com`),
   - `NEXT_PUBLIC_SITE_URL` — adres strony (najpierw `https://<projekt>.vercel.app`, potem twoja domena),
   - `NEXT_PUBLIC_SUPABASE_URL` i `NEXT_PUBLIC_SUPABASE_ANON_KEY` — te same publiczne wartości co w `.env`
     (bez nich konta na stronie są wyłączone). Klucza secret tu **nie** wpisuj.
   - `ENABLE_EXPERIMENTAL_COREPACK` = `1` — Vercel użyje wersji pnpm z `packageManager` w `package.json`
     (bez tego instalacja może się wywrócić na niezgodnej wersji pnpm).
4. Po zmianie zmiennych w Vercel: Deployments → **Redeploy** (zmienne `NEXT_PUBLIC_*` są wklejane w kod przy budowaniu).

Status deploymentu pojawi się jako check „Vercel” przy commitach.

### Własna domena (później)

1. Vercel → projekt → Settings → **Domains** → dodaj domenę i ustaw u rejestratora rekordy DNS, które pokaże Vercel.
2. Zmień adres strony wszędzie, gdzie występuje: `NEXT_PUBLIC_SITE_URL` (Vercel, potem Redeploy), `WEB_ORIGIN`
   (Render → Environment — inaczej przeglądarka zablokuje zapytania do API przez CORS) i w Supabase → Authentication → URL
   Configuration (Site URL i Redirect URLs `…/konto`, `…/konto/nowe-haslo`).
3. Opcjonalnie domena dla API (np. `api.twojadomena.pl`) w Render → Settings → Custom Domains; wtedy zmień
   `NEXT_PUBLIC_API_URL` w Vercel i adres w grze (`PlayerSession.DefaultApiBaseUrl`).

### Lokalnie: zmienne strony

Po dopisaniu albo zmianie `NEXT_PUBLIC_*` w `.env` zatrzymaj `pnpm dev` i uruchom go ponownie — strona wczytuje je przy
starcie. Jeśli `/konto` dalej pisze „Konta są wyłączone”, usuń `apps/web/.next` i uruchom ponownie.

## Render (API)

Konfiguracja jest w repo: `render.yaml` (Blueprint). Plan **Free** ma swoje limity:

- usługa usypia po 15 minutach bez ruchu, a pierwsze zapytanie po uśpieniu czeka ok. minuty;
- 750 darmowych godzin pracy miesięcznie na konto, czyli wystarczy na jedną usługę działającą cały miesiąc;
- transfer i minuty budowania są limitowane miesięcznie.

1. render.com → **New → Blueprint** → wybierz repozytorium (Render czyta `render.yaml`).
2. Render zapyta o zmienne oznaczone w pliku jako sekretne. Wpisz:
   - `WEB_ORIGIN` — adres strony z Vercel, np. `https://buds.vercel.app` (bez `/` na końcu; inaczej przeglądarka
     zablokuje zapytania przez CORS),
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET` — jak w sekcji Supabase niżej,
   - `SUPABASE_PUBLISHABLE_KEY` — ten sam publiczny klucz co `NEXT_PUBLIC_SUPABASE_ANON_KEY` (logowanie na konto w grze).

   Resztę (`NODE_VERSION`, `CLIENT_IP_HEADER` i ustawienia pnpm) ustawia `render.yaml`. `PORT` ustawia Render.
   **Bez `SUPABASE_SERVICE_ROLE_KEY` API trzyma dane w pamięci i traci je przy każdym uśpieniu.**

3. Po pierwszym deployu adres API to `https://buds-api.onrender.com` (albo z dopiskiem, jeśli nazwa była zajęta —
   widać go na górze strony usługi). Sprawdzenie: `https://<adres>/health` zwraca `{"status":"ok",…}`.
4. Wpisz ten adres jako `NEXT_PUBLIC_API_URL` w Vercel i zrób Redeploy strony.
5. Żeby API nie usypiało: darmowy monitor (np. UptimeRobot, typ HTTP(s)) na `https://<adres>/health` co 10 minut.
   Mieści się w 750 godzinach.
6. Kolejne pushe na `main` wdrażają API same, ale tylko gdy zmieni się `apps/api`, `packages/shared`, lockfile albo
   `render.yaml`.

`CLIENT_IP_HEADER=cf-connecting-ip`: limity zapytań (m.in. na zgadywanie kodów parowania) liczą się po IP klienta.
Na Render nagłówki `X-Real-IP` / `X-Forwarded-For` przechodzą od klienta i dałoby się je podrobić, a
`CF-Connecting-IP` zawsze ustawia brzeg Render (Cloudflare). Sprawdzenie po deployu (szósta próba ma dać `429`):

```bash
for i in 1 2 3 4 5 6; do curl -s -o /dev/null -w "%{http_code}\n" -X POST https://<adres>/v1/pair \
  -H "content-type: application/json" -H "X-Real-IP: 10.0.0.$i" -d '{"code":"AAAAAA"}'; done
```

Przy domyślnym `CREATE_LIMIT_PER_MINUTE=5` wynik to pięć odpowiedzi `404` (albo `400`) i potem `429`. Jeśli wszystkie są `404`, napisz.

Railway dalej działa jako alternatywa: `apps/api/railway.json` (Config file path), te same zmienne bez
`CLIENT_IP_HEADER`.

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

   Lokalnie wpisz je do pliku `.env` w katalogu głównym (jest w `.gitignore`), na produkcji do zmiennych w Render.
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

1. Adres produkcyjnego API jest w `PlayerSession.DefaultApiBaseUrl`
   (`Assets/Buds/Scripts/Runtime/Core/PlayerSession.cs`, teraz `https://buds-api-9vhw.onrender.com`) — musi być HTTPS.
   Buildy na telefon (`pnpm phone`) też łączą się z nim; z API na komputerze: `pnpm phone --local`, z innym serwerem:
   `BUDS_API_URL=… pnpm phone`. Adres wpisany w polu „Serwer” na ekranie startowym gry ma pierwszeństwo
   (wyczyszczenie pola wraca do adresu z builda).
2. Build: menu **Buds → Build → Android APK (dev)** albo w trybie wsadowym
   `-executeMethod Buds.EditorTools.BudsBuild.AndroidDev`.
3. Do Google Play potrzebny będzie build release (AAB) podpisany własnym keystore — dodamy go
   przed pierwszą publikacją. iOS wymaga Maca z Xcode albo Unity Build Automation.
