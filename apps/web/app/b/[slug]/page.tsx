import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { GENDER_LABELS, levelFromXp, moodBlurb, moodLabel } from '@buds/shared';
import { BudPreview } from '@/components/BudPreview';
import { PairPanel } from '@/components/PairPanel';
import { getBud } from '@/lib/api';

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ nowy?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const bud = await getBud(slug);
  if (!bud) return { title: 'Bud nie znaleziony' };
  const title = `${bud.name} — ${moodLabel(bud.look.mood, bud.look.gender).toLowerCase()} Bud`;
  const description = `Poznaj ${bud.name} i stwórz własnego ziomka w Buds.`;
  return { title, description, openGraph: { title, description }, twitter: { title, description } };
}

export default async function BudPage({ params, searchParams }: Props) {
  const [{ slug }, { nowy }] = await Promise.all([params, searchParams]);
  const bud = await getBud(slug);
  if (!bud) notFound();

  const info = levelFromXp(bud.xp);

  return (
    <main className="container bud-page">
      <section className="bud-hero card">
        <div className="stage stage-lg">
          <BudPreview look={bud.look} height={300} name={bud.name} />
          <div className="stage-floor" aria-hidden />
        </div>

        <div className="bud-info">
          <span className="tag">{GENDER_LABELS[bud.look.gender]}</span>
          <h1 className="bud-name">{bud.name}</h1>
          <p className="bud-mood">
            {moodLabel(bud.look.mood, bud.look.gender)} —{' '}
            {moodBlurb(bud.look.mood, bud.look.gender)}
          </p>

          <div className="level">
            <div className="level-head">
              <span className="level-num">Poziom {info.level}</span>
              <span className="muted">
                {info.xp} / {info.nextXp} XP
              </span>
            </div>
            <div
              className="level-bar"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(info.progress * 100)}
            >
              {Array.from({ length: 10 }, (_, i) => (
                <span key={i} className={i < Math.round(info.progress * 10) ? 'on' : ''} />
              ))}
            </div>
            <p className="fineprint">XP zdobywa się w grze: zadania, walka, mini-gry.</p>
          </div>
        </div>
      </section>

      <PairPanel slug={bud.slug} name={bud.name} gender={bud.look.gender} isNew={nowy === '1'} />
    </main>
  );
}
