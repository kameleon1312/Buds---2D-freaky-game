import Link from 'next/link';
import { BudSprite } from '@/components/BudSprite';
import { sampleLooks } from '@/lib/looks';

const [lost] = sampleLooks(1, 404);

export default function NotFound() {
  return (
    <main className="container center-page">
      {lost && <BudSprite look={{ ...lost, mood: 'zaspany' }} height={160} />}
      <h1>Tu nikogo nie ma</h1>
      <p className="lead">Link jest błędny albo ten Bud nigdy nie powstał.</p>
      <Link href="/" className="btn btn-primary btn-big">
        Stwórz swojego
      </Link>
    </main>
  );
}
