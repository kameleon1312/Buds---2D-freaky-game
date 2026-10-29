import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Prywatność',
  description: 'Jakie dane zbiera Buds, po co, jak długo je trzymamy i jakie masz prawa.',
};

// A draft for the game's author to complete (the administrator's name and contact) and review with a lawyer
// before the store release.
export default function PrivacyPage() {
  return (
    <main className="container account-page">
      <h1>Prywatność</h1>
      <section className="card panel prose">
        <h2>Jakie dane przechowujemy</h2>
        <ul>
          <li>
            <strong>Konto:</strong> adres e-mail i hasło. Hasło trzyma dostawca logowania (Supabase)
            wyłącznie w postaci zabezpieczonej, nigdy jawnie.
          </li>
          <li>
            <strong>Twój Bud:</strong> imię, wygląd, poziom i XP, ukończone zadania, znalezione
            skrytki, przedmioty, ekwipunek, umiejętności, ciosy, monety, gemy, ekipa, wyniki w
            Rewirach i dystrykt.
          </li>
          <li>
            <strong>Urządzenia:</strong> klucz urządzenia i kody łączenia z grą. Przechowujemy tylko
            ich skrót, nie same klucze.
          </li>
          <li>
            <strong>Gra na żywo:</strong> pozycja Buda na mapie i wiadomości na czacie trafiają do
            innych graczy na tej samej mapie w chwili wysłania. Czatu nie zapisujemy na serwerze.
          </li>
          <li>
            <strong>Zakupy:</strong> co kupiono i kiedy, żeby przyznać gemy i rozpatrzyć reklamację.
            Danych karty nie widzimy: płatność obsługuje sklep z aplikacjami.
          </li>
          <li>
            <strong>Dane techniczne:</strong> adres IP, tylko na chwilę, do ochrony przed
            nadużyciami (limity zapytań). Nie budujemy z niego profilu.
          </li>
        </ul>

        <h2>Po co</h2>
        <p>
          Żeby gra działała: zapisywała postępy, chroniła przed oszustwami i pozwalała grać z
          innymi. Nie sprzedajemy danych, nie pokazujemy reklam opartych na twoim profilu i nie
          używamy danych do niczego innego.
        </p>

        <h2>Kto co widzi</h2>
        <p>
          Publiczny profil, ranking i gra na żywo pokazują imię, wygląd i poziom Buda (oraz tag
          ekipy). Monety, przedmioty, ekwipunek i postępy widzisz wyłącznie ty, po zalogowaniu.
        </p>

        <h2>Kto przetwarza dane w naszym imieniu</h2>
        <ul>
          <li>Supabase: baza danych i logowanie.</li>
          <li>Render: serwer gry.</li>
          <li>Vercel: strona internetowa.</li>
          <li>Google Play: pobieranie gry i płatności.</li>
        </ul>

        <h2>Jak długo</h2>
        <p>
          Dopóki masz konto albo Buda. Po usunięciu konta lub Buda dane znikają od razu z bazy gry;
          kopie zapasowe wygasają same w ciągu 30 dni.
        </p>

        <h2>Twoje prawa</h2>
        <ul>
          <li>
            <strong>Wgląd i przeniesienie:</strong> na stronie <Link href="/konto">Konto</Link>{' '}
            pobierzesz wszystkie swoje dane jednym przyciskiem (plik JSON). W grze: Twój Bud →
            Profil → Konto.
          </li>
          <li>
            <strong>Poprawienie:</strong> imię i wygląd Buda zmienisz w grze albo na stronie konta.
          </li>
          <li>
            <strong>Usunięcie:</strong> konto albo pojedynczego Buda usuniesz sam, w grze lub na
            stronie. Zobacz <Link href="/usun-konto">jak usunąć konto</Link>.
          </li>
          <li>
            <strong>Sprzeciw i skarga:</strong> możesz napisać do nas, a także złożyć skargę do
            Prezesa UODO.
          </li>
        </ul>

        <h2>Dzieci</h2>
        <p>
          Gra jest dla osób od 13 lat. Czat filtruje wulgaryzmy, linki, adresy e-mail i numery
          telefonów; innego gracza wyciszysz jednym gestem.
        </p>

        <p className="fineprint">
          Wersja robocza. Przed publikacją w sklepach uzupełnimy dane administratora i kontakt.
        </p>
      </section>
    </main>
  );
}
