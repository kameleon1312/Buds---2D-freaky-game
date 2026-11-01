# Konto, postać i ustawienia

Wszystko, co gracz może zrobić ze swoim kontem, swoim Budem i swoimi danymi: w grze, na stronie i przez API.
Spełnia wymagania Google Play (usuwanie konta w aplikacji i na stronie) i RODO (wgląd, przeniesienie, usunięcie).

## Zakładanie konta i logowanie

Konto zakłada serwer gry: `POST /v1/auth/signup` (`signUpRequestSchema`: e-mail, hasło 8–72 bajtów, zgoda na zasady
prywatności) tworzy logowanie przez admin API Supabase od razu potwierdzone (`email_confirm: true`), a strona albo
gra loguje się zaraz potem tym samym e-mailem i hasłem (Supabase Auth, `signInWithPassword` /
`/auth/v1/token`). Nowy gracz nie czeka więc na e-mail z potwierdzeniem: wbudowana poczta Supabase wysyła tylko do
adresów członków zespołu projektu i ma limit kilku wiadomości na godzinę, więc rejestracja oparta na niej nie działała
dla graczy („Coś poszło nie tak”). Zajęty e-mail to 409 `email_taken`, za słabe hasło według reguł projektu to 400
`weak_password`. Limit: `SIGNUP_LIMIT_PER_HOUR` (10) nowych kont na adres IP na godzinę. Hasło przechodzi przez API
tylko w drodze do Supabase: nie jest nigdzie zapisywane ani logowane.

- **Strona** (`/konto`, `AccountPanel.tsx`): zakładki Zaloguj się / Załóż konto, po założeniu od razu panel konta.
  Błędy logowania po polsku (`authMessage`: zły e-mail lub hasło, brak sieci, limit prób, poczta, wygasły link).
- **Gra** (`LoginScreen`, `GameBootstrap.Login.cs`): „Nie masz konta? Załóż je” przełącza formularz (drugie hasło,
  zgoda pod polami); `AccountForm.Problem` sprawdza to samo co serwer, zanim cokolwiek wyśle.
- **Reset hasła** (`/konto` → Nie pamiętasz hasła?) nadal wysyła e-mail przez Supabase: żeby docierał do każdego
  gracza, w panelu Supabase (Authentication → Emails → SMTP Settings) trzeba podpiąć własny serwer poczty (np. Resend,
  Brevo). Bez tego dociera tylko do adresów członków zespołu projektu.

## W grze

Twój Bud → Profil:

- **Konto**:
  - **Zmień imię**: raz na `RENAME_DAYS` (7) dni, według tych samych zasad co przy tworzeniu Buda (filtr przekleństw
    i kontaktów); inni gracze widzą nowe imię od razu;
  - **Wyloguj inne urządzenia**: to urządzenie zostaje zalogowane;
  - **Moje dane**: wszystko, co gra przechowuje o Budzie, trafia do schowka jako JSON;
  - **Prywatność**, **Regulamin**: strony z adresu podanego przez serwer (`/v1/auth/config` → `site`);
  - **Usuń postać**: po wpisaniu imienia Buda; potem gra wraca do ekranu startowego.
- **Ustawienia** (zapisane na urządzeniu, `GameSettings`, działają od razu):

| Ustawienie    | Co zmienia                                                                                  |
| ------------- | ------------------------------------------------------------------------------------------- |
| Płynność      | 30 albo 60 klatek na sekundę                                                                |
| Grafika       | pełna albo oszczędna: bez filtru kolorów (post-processingu) i bez drobnego życia wokół Buda |
| Wibracje      | krótkie drgnięcie przy otrzymanym ciosie, dłuższe przy nokaucie                             |
| Liczby ciosów | liczby obrażeń nad głowami                                                                  |

Kod: `UI/AccountScreen.cs` (`AccountScreen`, `SettingsScreen`), `Core/GameBootstrap.Account.cs`,
`Core/GameSettings.cs` (`GameSettings`, `Haptics`). Demo: `-buds-account-demo` (pokazuje Profil, okno konta, zmianę
imienia, odmowę drugiej zmiany i ustawienia, a na końcu usuwa postać).

## Na stronie (`/konto`)

- **Karta każdego Buda** ma przyciski Zmień imię, Wyloguj ze wszystkich urządzeń i Usuń Buda (z wpisaniem imienia).
- **Ustawienia konta** to Nowe hasło, Pobierz moje dane (plik JSON) i Usuń konto (z wpisaniem `USUŃ KONTO`).
  Usunięcie konta usuwa każdego Buda na nim i samo logowanie.
- **Strony publiczne:**
  - `/prywatnosc`: pełna polityka prywatności;
  - `/regulamin`;
  - `/usun-konto`: jak usunąć konto i co znika; ten adres podaje się w Google Play.

## API

| Trasa                                    | Kto              | Co robi                                                     |
| ---------------------------------------- | ---------------- | ----------------------------------------------------------- |
| `POST /v1/auth/signup`                   | każdy (limit)    | zakłada konto gotowe do logowania                           |
| `PUT /v1/buds/me/name`                   | token urządzenia | nowe imię (raz na 7 dni)                                    |
| `POST /v1/buds/me/logout-all`            | token urządzenia | wylogowuje pozostałe urządzenia                             |
| `GET /v1/buds/me/export`                 | token urządzenia | wszystkie dane Buda (JSON)                                  |
| `DELETE /v1/buds/me`                     | token urządzenia | usuwa Buda (`confirm` = imię)                               |
| `PUT /v1/account/buds/:slug/name`        | konto            | nowe imię Buda z konta                                      |
| `POST /v1/account/buds/:slug/logout-all` | konto            | wylogowuje wszystkie urządzenia Buda                        |
| `DELETE /v1/account/buds/:slug`          | konto            | usuwa Buda z konta (`confirm` = imię)                       |
| `GET /v1/account/export`                 | konto            | dane konta i wszystkich jego Budów                          |
| `DELETE /v1/account`                     | konto            | usuwa konto ze wszystkimi Budami (`confirm` = `USUŃ KONTO`) |

Cudzy Bud wygląda jak nieistniejący (404). Usunięcie Buda najpierw wyprowadza go z ekipy (`leave_crew`: lider
przekazuje ją dalej), potem kasuje wiersz `buds`; wszystkie tabele `bud_*`, tokeny, dystrykt i oferty na Bazarze
znikają kaskadowo. Serwer gry na żywo od razu rozłącza usuniętego albo wylogowanego Buda (`hooks.budGone` →
`live.dropBud`), a nowe imię pokazuje innym w pokoju (`hooks.budChanged` → `live.refreshBud`). Kształty żądań i
odpowiedzi są w `packages/shared/src/account.ts`, migracja to `20261029000000_account.sql` (`buds.name_changed_at`).
Eksport zawiera też odkryty teren mapy (`explored`).

Testy: `apps/api/test/account.test.ts`.

## Bezpieczeństwo

- **Bud na koncie wychodzi tylko przez konto.** Kod do gry (`POST /v1/buds/me/pair-code`) dostaje wyłącznie Bud bez
  konta; Bud na koncie dostaje go tylko po zalogowaniu (`/v1/account/buds/:slug/pair-code`, 403 `bud_on_account`
  dla tokenu urządzenia). Dodanie Buda do konta (`/v1/account/buds/claim`) unieważnia klucz gościa z przeglądarki,
  a strona go zapomina (`forgetPlayer`), więc po wylogowaniu przeglądarka jest zwykłym gościem. Obcy w rankingu
  nigdy nie miał klucza: widzi tylko publiczny profil.

- **Publiczne nazwy** (imię Buda, nazwa i tag ekipy, nazwa dystryktu) przechodzą przez `publicNameOk`: filtr czatu na
  nazwie takiej, jak jest, i ze sklejonymi znakami („Ku rwa”, „k.u.r.w.a”).
- **Limity zapytań** zapominają adresy po końcu okna; wcześniej pamięć rosła z każdym nowym adresem.
- **Strona** wysyła nagłówki:
  - `Content-Security-Policy`: tylko własne skrypty i style, połączenia wyłącznie z API i logowaniem, bez ramek,
    wtyczek i obcych formularzy;
  - `Strict-Transport-Security` i `Cross-Origin-Opener-Policy`.

  W przeglądarce zod nie sprawdza `eval` (`packages/shared/src/browser.ts`), więc CSP nie zgłasza naruszeń.

- **Funkcje wyzwalaczy w bazie** są zamknięte dla ról `anon`/`authenticated` (`handle_new_user` zostaje dla
  `supabase_auth_admin`).
- **Build release gry** loguje tylko ostrzeżenia i błędy, rozmawia wyłącznie po HTTPS i nigdy nie zawiera adresu
  serwera deweloperskiego.
