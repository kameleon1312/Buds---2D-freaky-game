# Konto, postać i ustawienia

Wszystko, co gracz może zrobić ze swoim kontem, swoim Budem i swoimi danymi: w grze, na stronie i przez API.
Spełnia wymagania Google Play (usuwanie konta w aplikacji i na stronie) i RODO (wgląd, przeniesienie, usunięcie).

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
Testy: `apps/api/test/account.test.ts`.

## Bezpieczeństwo

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
