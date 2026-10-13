import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Prywatność',
  description: 'Jakie dane zbiera Buds i jak je chronimy.',
};

// Draft for the game's author to review with a lawyer before the store release.
export default function PrivacyPage() {
  return (
    <main className="container account-page">
      <h1>Prywatność</h1>
      <section className="card panel prose">
        <h2>Jakie dane przechowujemy</h2>
        <ul>
          <li>
            <strong>Konto:</strong> adres e-mail i hasło (hasło tylko w formie zabezpieczonej, nigdy
            jawnie).
          </li>
          <li>
            <strong>Twój Bud:</strong> imię, wygląd, poziom i XP, ukończone zadania, znalezione
            skrytki, przedmioty, ekwipunek, umiejętności i monety.
          </li>
          <li>
            <strong>Urządzenia:</strong> klucz gościa i kod łączenia z grą. Przechowujemy tylko ich
            skrót, nie same klucze.
          </li>
        </ul>
        <h2>Kto co widzi</h2>
        <p>
          Publiczny profil i ranking pokazują tylko imię, wygląd i poziom Buda. Monety, przedmioty,
          ekwipunek i postępy widzisz wyłącznie ty, po zalogowaniu.
        </p>
        <h2>Twoje prawa</h2>
        <p>
          Możesz w każdej chwili poprosić o wgląd w swoje dane albo ich usunięcie razem z kontem.
          Nie sprzedajemy danych i nie pokazujemy reklam opartych na twoim profilu.
        </p>
        <p className="fineprint">
          Wersja robocza. Przed publikacją w sklepach uzupełnimy dane administratora i kontakt.
        </p>
      </section>
    </main>
  );
}
