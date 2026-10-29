# Gra na telefonie (Android)

Wersja testowa (dev) łączy się z API na twoim komputerze przez domowe Wi-Fi.

## Raz, na start

1. **Telefon:** Ustawienia → Informacje o telefonie → 7× „Numer kompilacji” (włącza opcje programisty).
   Potem Opcje programisty → **Debugowanie bezprzewodowe** → włącz.
2. **Parowanie:** na telefonie „Sparuj urządzenie za pomocą kodu parowania”, a na komputerze:
   `pnpm phone pair <ip:port> <kod>` (adres i kod z ekranu parowania).
3. **Zapora Windows:** wpuść API z sieci domowej (PowerShell jako administrator):
   `New-NetFirewallRule -DisplayName "Buds API (dev)" -Direction Inbound -Protocol TCP -LocalPort 4000 -Action Allow -Profile Private`

## Za każdym razem

1. `pnpm dev` (API na porcie 4000).
2. `pnpm phone connect <ip:port>` — adres z ekranu „Debugowanie bezprzewodowe” (zmienia się po restarcie telefonu).
3. `pnpm phone` — buduje APK (pierwszy raz 10–15 min, potem kilka), instaluje go i uruchamia grę.
   `pnpm phone --no-build` instaluje ostatni APK jeszcze raz. Edytor Unity musi być zamknięty na czas budowania.

Gra łączy się z produkcyjnym API (Render, `PlayerSession.DefaultApiBaseUrl`). `pnpm phone --local` wpisuje zamiast
niego adres komputera w sieci domowej (`http://<IP>:4000`, plik `Resources/Dev/api.txt`, poza gitem; `pnpm dev` musi
działać). Inny serwer: `BUDS_API_URL=http://host:port pnpm phone`. Adres wpisany w polu „Serwer” na ekranie parowania
zapamiętuje się i wygrywa z buildem; wyczyszczenie pola wraca do adresu z builda.

## Wersja do sklepu (Google Play)

`Buds.EditorTools.BudsBuild.AndroidRelease` buduje `Builds/Android/Buds.aab`. To App Bundle, czyli format, który
przyjmuje Google Play. Build ma:

- IL2CPP i 64-bit ARM;
- najnowszy zainstalowany target SDK;
- tylko HTTPS i produkcyjne API;
- ciche logi (tylko ostrzeżenia i błędy).

Podpisuje go klucz przesyłania z zmiennych środowiskowych (nigdy w repozytorium):

```bash
BUDS_KEYSTORE=/sciezka/buds-upload.keystore BUDS_KEYSTORE_PASS=... BUDS_KEY_ALIAS=buds BUDS_KEY_PASS=... \
BUDS_VERSION=1.0.0 BUDS_VERSION_CODE=1 \
"$UNITY" -batchmode -nographics -quit -projectPath apps/unity -executeMethod Buds.EditorTools.BudsBuild.AndroidRelease -logFile -
```

`BUDS_VERSION_CODE` musi rosnąć z każdym wysłanym plikiem. Bez klucza build się nie zaczyna. Po buildzie hasła są
czyszczone z ustawień edytora. W konsoli Google Play podaj adres `/usun-konto` jako stronę usuwania konta, a
`/prywatnosc` jako politykę prywatności.

## Układ na telefonie

Gra działa tylko w poziomie. Na telefonie: plakietka gracza i zadania w lewym górnym rogu, przyciski „Twój Bud”, „Mapa”
i jazda w prawym górnym, przycisk akcji (Rozmawiaj, Przeszukaj…) na środku u dołu, joystick na stałe w lewym dolnym
rogu, a przyciski walki w prawym dolnym (`docs/walka.md`). Dotknięcie okna rozmowy przechodzi dalej. Interfejs jest większy na
małych ekranach (`UiKit.CanvasHeight`), a kamera pokazuje mniej pól (`FollowCamera.CompactTiles*`). Wszystko mieści
się w bezpiecznym obszarze ekranu (wycięcia na aparat). Na PC ten układ sprawdzisz flagą `-buds-mobile`, np.
`Buds.exe -screen-width 1600 -screen-height 720 -buds-guest -buds-mobile -buds-autoshot <dir>`.
