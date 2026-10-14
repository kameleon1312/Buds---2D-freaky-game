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

Build wpisuje do gry adres komputera w sieci domowej (`http://<IP>:4000`, plik `Resources/Dev/api.txt`, poza gitem).
Inny serwer: `BUDS_API_URL=http://host:port pnpm phone` albo pole adresu na dole ekranu parowania (zapamiętuje się).
Gdy zmieni się IP komputera, zbuduj ponownie albo wpisz nowy adres w tym polu.

## Układ na telefonie

Gra działa tylko w poziomie. Na telefonie: plakietka gracza i zadania w lewym górnym rogu, przyciski „Twój Bud”, „Mapa”
i jazda w prawym górnym, przycisk akcji (Rozmawiaj, Walcz, Przeszukaj…) w lewym dolnym, a joystick stoi na stałe w
prawym dolnym rogu (dociśnięty do brzegu = bieg). Dotknięcie okna rozmowy przechodzi dalej. Interfejs jest większy na
małych ekranach (`UiKit.CanvasHeight`), a kamera pokazuje mniej pól (`FollowCamera.CompactTiles*`). Wszystko mieści
się w bezpiecznym obszarze ekranu (wycięcia na aparat). Na PC ten układ sprawdzisz flagą `-buds-mobile`, np.
`Buds.exe -screen-width 1600 -screen-height 720 -buds-guest -buds-mobile -buds-autoshot <dir>`.
