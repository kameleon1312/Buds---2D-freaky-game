import type { Metadata } from 'next';
import Link from 'next/link';
import { levelFromXp, moodLabel } from '@buds/shared';
import { BudSprite } from '@/components/BudSprite';
import { getLeaderboard } from '@/lib/api';

export const metadata: Metadata = {
  title: 'Ranking',
  description: 'Najwyżej rozwinięte Budy. XP zdobywa się w grze.',
};

export const dynamic = 'force-dynamic';

export default async function TopPage() {
  const buds = await getLeaderboard(50);

  return (
    <main className="container">
      <section className="hero hero-compact">
        <h1>Ranking</h1>
        <p className="lead">Najwyżej rozwinięte Budy. XP zdobywa się tylko w grze.</p>
      </section>

      {buds.length === 0 ? (
        <div className="card empty">
          <p>Jeszcze nikogo tu nie ma. Pierwszy Bud zgarnia podium.</p>
          <Link href="/" className="btn btn-primary">
            Stwórz Buda
          </Link>
        </div>
      ) : (
        <ol className="board card">
          {buds.map((bud, i) => (
            <li key={bud.slug}>
              <Link href={`/b/${bud.slug}`} className="board-row">
                <span className={`board-rank ${i < 3 ? `podium podium-${i + 1}` : ''}`}>
                  {i + 1}
                </span>
                <BudSprite look={bud.look} height={48} />
                <span className="board-name">
                  <strong>{bud.name}</strong>
                  <small className="muted">{moodLabel(bud.look.mood, bud.look.gender)}</small>
                </span>
                <span className="board-level">
                  <strong>Poz. {levelFromXp(bud.xp).level}</strong>
                  <small className="muted">{bud.xp} XP</small>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
