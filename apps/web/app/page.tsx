import type { CSSProperties } from 'react';
import Link from 'next/link';
import {
  CATALOG,
  SKILLS,
  SLOTS,
  STATS,
  moodBlurb,
  moodLabel,
  MOODS,
  type BudLook,
  type CatalogItem,
} from '@buds/shared';
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

/** "+10% Szybkość · +1 Spryt" — what a piece of gear adds. */
function bonusText(item: CatalogItem): string {
  const parts = STATS.filter((s) => item.bonus?.[s.id]).map(
    (s) => `+${item.bonus![s.id]}${s.unit} ${s.name}`,
  );
  for (const [id, n] of Object.entries(item.bonus?.skills ?? {}))
    parts.push(`+${n} ${SKILLS.find((s) => s.id === id)?.name ?? id}`);
  return parts.join(' · ');
}

/** One example item per slot, the strongest the coin shop or quests offer. */
const GEAR = SLOTS.map((slot) => {
  const items = CATALOG.filter((i) => i.available && i.slot === slot.id);
  const best = items.sort((a, b) => b.price.amount - a.price.amount)[0];
  return { slot, item: best };
});

const FEATURES = [
  {
    title: 'Cztery dzielnice',
    text: 'Miasto Ziomków, tropikalne Las Palmas, Dwór Carski i niebezpieczne Los Karkos. Każda z mieszkańcami i zadaniami.',
  },
  {
    title: 'Wejdź do środka',
    text: 'Kawiarnia, komisariat, siłownia, salon dworku… Budynki mają wnętrza, a w nich niejedną tajemnicę.',
  },
  {
    title: 'Ukryte skrytki',
    text: 'Skrzynie, kufry i luźne cegły pojawiają się dopiero, gdy podejdziesz blisko. W środku monety i XP.',
  },
  {
    title: 'Ekwipunek ze statystykami',
    text: 'Buty dodają szybkości, bluza z kewlaru daje pancerz, okulary szczęścia. Zdobywasz je w grze.',
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
            Ziomki i ziomeczki z charakterem. Ułóż swojego Buda, połącz go z grą i ruszaj na
            przygodę: dzielnice, zadania od mieszkańców, ukryte skrytki i ekwipunek, który naprawdę
            coś daje.
          </p>
          <div className="hero-actions">
            <Link href="#kreator" className="btn btn-primary btn-big">
              Stwórz Buda
            </Link>
            <Link href="/konto" className="btn btn-big">
              Załóż konto
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

      <section className="container section">
        <h2 className="section-title">Co cię czeka w grze</h2>
        <div className="features">
          {FEATURES.map((f) => (
            <div className="feature card" key={f.title}>
              <h3>{f.title}</h3>
              <p className="muted">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="container section" id="kreator">
        <h2 className="section-title">Ułóż swojego Buda</h2>
        {initial && <Creator initialLook={initial} />}
      </section>

      <section className="container section">
        <h2 className="section-title">Ekwipunek od stóp do głów</h2>
        <p className="lead section-lead">
          Osiem miejsc na postaci. Każdy przedmiot dodaje coś do statystyk albo umiejętności, a
          zdobywasz je w zadaniach, skrytkach i w sklepie za monety z gry. Za prawdziwe pieniądze
          będzie tylko wygląd, nigdy przewaga.
        </p>
        <div className="gear-showcase card">
          <div className="gear-doll" aria-hidden>
            <BudSprite look={CREW[1]!} height={260} />
          </div>
          <ul className="gear-slots">
            {GEAR.map(({ slot, item }) => (
              <li key={slot.id}>
                <span className="gear-slot-name">{slot.name}</span>
                <strong>{item?.name ?? '—'}</strong>
                {item && <span className="gear-bonus">{bonusText(item)}</span>}
              </li>
            ))}
          </ul>
        </div>
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
          <p>
            Na stronie Buda albo w koncie dostaniesz kod. Wpisujesz go w grze i gotowe. Konto jest
            opcjonalne, ale chroni postępy.
          </p>
        </div>
        <div className="step card">
          <span className="step-num">3</span>
          <h3>Graj</h3>
          <p>Mapa, zadania od mieszkańców, skrytki i ekwipunek. Twój Bud rośnie razem z tobą.</p>
        </div>
      </section>

      <section className="container section">
        <div className="cta-band card">
          <div>
            <h2>Twój Bud bezpieczny na każdym urządzeniu</h2>
            <p className="muted">
              Załóż konto e-mailem i hasłem. Postępy, ekwipunek i monety zostają z tobą, nawet gdy
              zmienisz telefon. Te dane widzisz tylko ty.
            </p>
          </div>
          <Link href="/konto" className="btn btn-buds btn-big">
            Załóż konto
          </Link>
        </div>
      </section>
    </main>
  );
}
