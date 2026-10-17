import type { Metadata } from 'next';
import Link from 'next/link';
import { CHALLENGES, levelFromXp, moodLabel } from '@buds/shared';
import { BudSprite } from '@/components/BudSprite';
import { getLeaderboard, getRanking } from '@/lib/api';
import { plural } from '@/lib/plural';

export const metadata: Metadata = {
  title: 'Ranking',
  description: 'Kto rządzi rewirami w tym tygodniu, najmocniejsze ekipy i ligi pojedynków Budów.',
};

export const dynamic = 'force-dynamic';

const VIEWS = [
  { id: 'tydzien', name: 'Ten tydzień' },
  { id: 'ekipy', name: 'Ekipy' },
  { id: 'wyzwania', name: 'Wyzwania' },
  { id: 'ligi', name: 'Ligi' },
  { id: 'xp', name: 'Wszech czasów' },
] as const;
type View = (typeof VIEWS)[number]['id'];

/** "3 dni 4 godz." until the week closes. */
function timeLeft(endsAt: string): string {
  const ms = Math.max(0, new Date(endsAt).getTime() - Date.now());
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  if (days > 0) return `${days} ${plural(days, 'dzień', 'dni', 'dni')} ${hours} godz.`;
  const minutes = Math.floor((ms % 3600000) / 60000);
  return `${hours} godz. ${minutes} min`;
}

/** "2 wygrane pojedynki", "5 wygranych pojedynków": the challenge unit agreeing with the count. */
function unitFor(id: string, count: number, fallback: string) {
  const units = CHALLENGES.find((c) => c.id === id)?.units;
  return units ? plural(count, units[0], units[1], units[2]) : fallback;
}

const Rank = ({ i }: { i: number }) => (
  <span className={`board-rank ${i < 3 ? `podium podium-${i + 1}` : ''}`}>{i + 1}</span>
);

const Tag = ({ tag }: { tag: string | null }) =>
  tag ? <span className="crew-tag">[{tag}]</span> : null;

export default async function TopPage({
  searchParams,
}: {
  searchParams: Promise<{ widok?: string }>;
}) {
  const { widok } = await searchParams;
  const view: View = VIEWS.some((v) => v.id === widok) ? (widok as View) : 'tydzien';
  const [ranking, buds] = await Promise.all([
    getRanking(),
    view === 'xp' ? getLeaderboard(50) : Promise.resolve([]),
  ]);

  return (
    <main className="container">
      <section className="hero hero-compact">
        <h1>Ranking</h1>
        <p className="lead">
          Rewiry, ekipy i pojedynki liczą się co tydzień od nowa. Zwycięzcy tygodnia zatrzymują
          tytuł na zawsze.
        </p>
        {ranking && (
          <p className="week-clock">
            <strong>{ranking.week.replace('-W', ' · tydzień ')}</strong>
            <span>Koniec za {timeLeft(ranking.endsAt)}</span>
          </p>
        )}
      </section>

      <nav className="rank-tabs" aria-label="Widok rankingu">
        {VIEWS.map((v) => (
          <Link
            key={v.id}
            href={v.id === 'tydzien' ? '/top' : `/top?widok=${v.id}`}
            className="chip"
            aria-pressed={v.id === view}
            scroll={false}
          >
            {v.name}
          </Link>
        ))}
      </nav>

      {view !== 'xp' && !ranking ? (
        <div className="card empty">
          <p>Serwer gry właśnie się budzi. Odśwież stronę za chwilę.</p>
        </div>
      ) : view === 'tydzien' ? (
        ranking!.buds.length === 0 ? (
          <Empty text="W tym tygodniu nikt jeszcze nie zdobył wpływu. Pierwszy pojedynek na rewirze i jesteś na szczycie." />
        ) : (
          <ol className="board card">
            {ranking!.buds.map((b, i) => (
              <li key={b.slug}>
                <Link href={`/b/${b.slug}`} className="board-row board-row-plain">
                  <Rank i={i} />
                  <span className="board-name">
                    <strong>
                      {b.name} <Tag tag={b.crewTag} />
                    </strong>
                    <small className="muted">Poz. {b.level}</small>
                  </span>
                  <span className="board-level">
                    <strong>{b.points}</strong>
                    <small className="muted">wpływu</small>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )
      ) : view === 'ekipy' ? (
        ranking!.crews.length === 0 ? (
          <Empty text="Żadna ekipa nie zdobyła jeszcze wpływu w tym tygodniu. Ekipę zakładasz w grze: Rewiry → Ekipa." />
        ) : (
          <ol className="board card">
            {ranking!.crews.map((c, i) => (
              <li key={c.tag}>
                <div className="board-row board-row-plain">
                  <Rank i={i} />
                  <span className="board-name">
                    <strong>
                      {c.name} <Tag tag={c.tag} />
                    </strong>
                    <small className="muted">
                      {c.members} {plural(c.members, 'osoba', 'osoby', 'osób')}
                    </small>
                  </span>
                  <span className="board-level">
                    <strong>{c.points}</strong>
                    <small className="muted">wpływu</small>
                  </span>
                </div>
              </li>
            ))}
          </ol>
        )
      ) : view === 'wyzwania' ? (
        <div className="challenge-grid">
          {ranking!.challenges.map((ch) => (
            <section key={ch.id} className="card challenge-card">
              <h2>{ch.name}</h2>
              {ch.leaders.length === 0 ? (
                <p className="muted">Nikt jeszcze nie zaczął.</p>
              ) : (
                <ol className="mini-board">
                  {ch.leaders.map((l, i) => (
                    <li key={l.slug}>
                      <Rank i={i} />
                      <Link href={`/b/${l.slug}`}>{l.name}</Link>
                      <span className="mini-count">
                        {l.count}{' '}
                        <small className="muted">{unitFor(ch.id, l.count, ch.unit)}</small>
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          ))}
        </div>
      ) : view === 'ligi' ? (
        ranking!.pvp.length === 0 ? (
          <Empty text="Nikt jeszcze nie wyzwał innego Buda. Pojedynki z Budami znajdziesz w grze: Rewiry → Pojedynki." />
        ) : (
          <ol className="board card">
            {ranking!.pvp.map((p, i) => (
              <li key={p.slug}>
                <Link href={`/b/${p.slug}`} className="board-row board-row-plain">
                  <Rank i={i} />
                  <span className="board-name">
                    <strong>{p.name}</strong>
                    <small className="muted">Liga: {p.league}</small>
                  </span>
                  <span className="board-level">
                    <strong>{p.rating}</strong>
                    <small className="muted">punktów</small>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )
      ) : buds.length === 0 ? (
        <Empty text="Jeszcze nikogo tu nie ma. Pierwszy Bud zgarnia podium." cta />
      ) : (
        <ol className="board card">
          {buds.map((bud, i) => (
            <li key={bud.slug}>
              <Link href={`/b/${bud.slug}`} className="board-row">
                <Rank i={i} />
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

function Empty({ text, cta = false }: { text: string; cta?: boolean }) {
  return (
    <div className="card empty">
      <p>{text}</p>
      {cta && (
        <Link href="/" className="btn btn-primary">
          Stwórz Buda
        </Link>
      )}
    </div>
  );
}
