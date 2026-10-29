import type { Metadata } from 'next';
import Link from 'next/link';
import { DELETE_ACCOUNT_WORDS } from '@buds/shared';

export const metadata: Metadata = {
  title: 'Usuwanie konta',
  description: 'Jak usunąć konto Buds albo pojedynczego Buda i co się wtedy dzieje z danymi.',
};

// The public page the store listing links to (Google Play asks every app with accounts for one): how to delete
// the account or a bud, from the website and from the game, and what is deleted.
export default function DeleteAccountPage() {
  return (
    <main className="container account-page">
      <h1>Usuwanie konta</h1>
      <section className="card panel prose">
        <h2>Na stronie</h2>
        <ol>
          <li>
            Zaloguj się na <Link href="/konto">stronie konta</Link>.
          </li>
          <li>
            W sekcji <strong>Ustawienia konta</strong> wybierz <strong>Usuń konto</strong>.
          </li>
          <li>
            Wpisz <strong>{DELETE_ACCOUNT_WORDS}</strong> i potwierdź.
          </li>
        </ol>
        <p>
          Pojedynczego Buda usuniesz tam samo: przycisk <strong>Usuń Buda</strong> na jego karcie,
          potwierdzony jego imieniem.
        </p>

        <h2>W grze</h2>
        <p>
          Twój Bud → Profil → <strong>Konto</strong> → <strong>Usuń postać</strong>, potwierdzone
          imieniem Buda. Tak usuniesz też Buda grającego bez konta.
        </p>

        <h2>Co zostaje usunięte</h2>
        <p>
          Wszystko od razu: konto i hasło, każdy Bud z poziomem, przedmiotami, ekwipunkiem, ciosami,
          monetami i gemami, miejsce w ekipie i rankingach, dystrykt, zalogowane urządzenia. Kopie
          zapasowe wygasają same w ciągu 30 dni. Zakupy nie są zwracane przy usunięciu.
        </p>

        <h2>Nie możesz się zalogować?</h2>
        <p>
          Zresetuj hasło na <Link href="/konto">stronie konta</Link> (link przyjdzie na e-mail), a
          potem usuń konto jak wyżej.
        </p>

        <p className="fineprint">
          Więcej o danych: <Link href="/prywatnosc">prywatność</Link>.
        </p>
      </section>
    </main>
  );
}
