import type { CSSProperties } from 'react';
import Link from 'next/link';
import { MOODS, moodBlurb, moodLabel, type BudLook } from '@buds/shared';
import { BudSprite } from '@/components/BudSprite';
import { Creator } from '@/components/Creator';
import { sampleLooks } from '@/lib/looks';

/** Hand-picked crew for the hero: varied genders, moods, styles and skin tones. */
const CREW: BudLook[] = [
  {
    gender: 'ona',
    mood: 'radosny',
    skin: 1,
    hair: 'kok',
    hairColor: 6,
    outfit: 'tshirt',
    outfitColor: 7,
    pantsColor: 0,
  },
  {
    gender: 'on',
    mood: 'zadziorny',
    skin: 4,
    hair: 'jezyk',
    hairColor: 0,
    outfit: 'bluza',
    outfitColor: 0,
    pantsColor: 1,
  },
  {
    gender: 'ona',
    mood: 'tajemniczy',
    skin: 2,
    hair: 'dlugie',
    hairColor: 4,
    outfit: 'kurtka',
    outfitColor: 6,
    pantsColor: 1,
  },
  {
    gender: 'on',
    mood: 'wyluzowany',
    skin: 0,
    hair: 'czapka',
    hairColor: 3,
    outfit: 'bluza',
    outfitColor: 2,
    pantsColor: 2,
  },
  {
    gender: 'ona',
    mood: 'niesmialy',
    skin: 5,
    hair: 'afro',
    hairColor: 0,
    outfit: 'ogrodniczki',
    outfitColor: 1,
    pantsColor: 0,
  },
];

export default function HomePage() {
  const [initial] = sampleLooks(1, 11);
  const moodModel = CREW[1]!;

  return (
    <main>
      <section className="hero container">
        <div className="hero-copy">
          <h1>
            Znajdź swojego <span className="hl">ziomka</span>.
          </h1>
          <p className="lead">
            Ziomki i ziomeczki z charakterem. Ułóż swojego Buda, połącz go z grą i ruszaj razem na
            przygodę: mapa, zadania, walka i craft.
          </p>
          <div className="hero-actions">
            <Link href="#kreator" className="btn btn-primary btn-big">
              Stwórz Buda
            </Link>
            <Link href="/top" className="btn btn-big">
              Ranking
            </Link>
          </div>
        </div>

        <div className="crew" aria-hidden>
          <div className="crew-hill" />
          {CREW.map((look, i) => (
            <div key={i} className={`crew-bud crew-bud-${i}`} style={{ '--i': i } as CSSProperties}>
              <BudSprite look={look} height={i === 2 ? 230 : i % 2 ? 190 : 205} />
            </div>
          ))}
        </div>
      </section>

      <section className="container section" id="kreator">
        <h2 className="section-title">Ułóż swojego Buda</h2>
        {initial && <Creator initialLook={initial} />}
      </section>

      <section className="container section">
        <h2 className="section-title">Każdy ma swój nastrój</h2>
        <p className="lead section-lead">
          Nastrój to nie tylko mina. To, jak twój Bud gada z mieszkańcami i jak reaguje na przygody.
        </p>
        <div className="moods">
          {MOODS.map((mood) => (
            <div className="mood card" key={mood}>
              <BudSprite look={{ ...moodModel, mood }} height={96} crop="head" />
              <div>
                <h3>{moodLabel(mood, moodModel.gender)}</h3>
                <p className="muted">{moodBlurb(mood, moodModel.gender)}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="container section steps">
        <div className="step card">
          <span className="step-num">1</span>
          <h3>Stwórz</h3>
          <p>Płeć, nastrój, karnacja, fryzura, ciuchy. Twój Bud wygląda tak, jak chcesz.</p>
        </div>
        <div className="step card">
          <span className="step-num">2</span>
          <h3>Połącz</h3>
          <p>Na stronie Buda dostaniesz kod. Wpisujesz go w grze i gotowe, bez zakładania konta.</p>
        </div>
        <div className="step card">
          <span className="step-num">3</span>
          <h3>Graj</h3>
          <p>Mapa, zadania od mieszkańców, walka i zbieranie. Twój Bud rośnie razem z tobą.</p>
        </div>
      </section>
    </main>
  );
}
