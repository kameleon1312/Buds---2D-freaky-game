import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Regulamin',
  description: 'Zasady gry Buds: konto, gra z innymi, zakupy, czat i odpowiedzialność.',
};

// A draft for the game's author to complete (the operator's name, address and contact) and review with a lawyer
// before the store release.
export default function TermsPage() {
  return (
    <main className="container account-page">
      <h1>Regulamin</h1>
      <section className="card panel prose">
        <h2>1. Gra</h2>
        <p>
          Buds to darmowa gra z opcjonalnymi zakupami. Grać może każdy od 13 lat; osoby
          niepełnoletnie za zgodą rodzica lub opiekuna, zwłaszcza przy zakupach.
        </p>

        <h2>2. Konto i Bud</h2>
        <ul>
          <li>
            Grasz Budem bez konta albo na koncie (e-mail i hasło). Konto chroni postępy na wielu
            urządzeniach.
          </li>
          <li>
            Dbasz o swoje hasło i kody łączenia z grą. Zgubione urządzenie wylogujesz na stronie
            konta.
          </li>
          <li>
            Imię Buda, nazwa ekipy i dystryktu są publiczne: nie mogą być obraźliwe ani zawierać
            danych kontaktowych.
          </li>
          <li>
            Konto i Budy usuniesz w każdej chwili (<Link href="/usun-konto">jak to zrobić</Link>).
          </li>
        </ul>

        <h2>3. Gra z innymi</h2>
        <ul>
          <li>
            Od poziomu 6 Budowie mogą walczyć ze sobą poza strefami bezpiecznymi. Nokaut kosztuje
            niewielką część monet z kieszeni, nigdy przedmioty.
          </li>
          <li>
            Na czacie obowiązuje szacunek: bez wyzwisk, gróźb, spamu i podawania danych
            kontaktowych.
          </li>
          <li>
            Zakazane są oszustwa: programy modyfikujące grę, boty, wykorzystywanie błędów, handel
            kontami i walutą gry poza grą.
          </li>
        </ul>

        <h2>4. Waluta i zakupy</h2>
        <ul>
          <li>
            Monety zdobywa się tylko w grze. Gemy kupuje się za prawdziwe pieniądze w sklepie z
            aplikacjami; dają wygląd, wygodę i przedmioty premium tak silne jak ich odpowiedniki do
            zdobycia w grze.
          </li>
          <li>
            Waluta i przedmioty gry nie są własnością w sensie prawnym i nie można ich wymienić na
            pieniądze.
          </li>
          <li>
            Zwroty rozpatruje sklep z aplikacjami według swoich zasad i przepisów konsumenckich.
          </li>
        </ul>

        <h2>5. Naruszenia</h2>
        <p>
          Za łamanie zasad możemy ostrzec, wyciszyć, zablokować grę z innymi albo usunąć konto.
          Odwołanie: napisz do nas.
        </p>

        <h2>6. Gra się zmienia</h2>
        <p>
          Rozwijamy grę: zmieniamy balans, treści i zasady. O istotnych zmianach regulaminu
          uprzedzimy w grze.
        </p>

        <h2>7. Dane osobowe</h2>
        <p>
          Zasady przetwarzania danych opisuje <Link href="/prywatnosc">polityka prywatności</Link>.
        </p>

        <p className="fineprint">
          Wersja robocza. Przed publikacją w sklepach uzupełnimy dane operatora, kontakt i podstawę
          prawną.
        </p>
      </section>
    </main>
  );
}
