import type { CSSProperties } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { CONTENT, type BudLook } from '@buds/shared';
import { BudSprite } from '@/components/BudSprite';
import { Creator } from '@/components/Creator';
import { GameplayTabs, ScrollProgress, type Shot } from '@/components/JourneyBits';
import { Reveal } from '@/components/Reveal';
import { Trail, type TrailStop } from '@/components/Trail';
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
    pants: 'spodnica',
    pantsColor: 0,
    shoes: 'trampki',
    shoesColor: 3,
  },
  {
    gender: 'on',
    mood: 'zadziorny',
    skin: 4,
    hair: 'jezyk',
    hairColor: 0,
    outfit: 'bluza',
    outfitColor: 0,
    pants: 'dresy',
    pantsColor: 1,
    shoes: 'wysokie',
    shoesColor: 1,
  },
  {
    gender: 'ona',
    mood: 'tajemniczy',
    skin: 2,
    hair: 'dlugie',
    hairColor: 4,
    outfit: 'kurtka',
    outfitColor: 6,
    pants: 'legginsy',
    pantsColor: 1,
    shoes: 'kozaki',
    shoesColor: 6,
  },
  {
    gender: 'on',
    mood: 'wyluzowany',
    skin: 0,
    hair: 'czapka',
    hairColor: 3,
    outfit: 'bluza',
    outfitColor: 2,
    pants: 'bojowki',
    pantsColor: 2,
    shoes: 'glany',
    shoesColor: 1,
  },
  {
    gender: 'ona',
    mood: 'niesmialy',
    skin: 5,
    hair: 'afro',
    hairColor: 0,
    outfit: 'ogrodniczki',
    outfitColor: 1,
    pants: 'szorty',
    pantsColor: 0,
    shoes: 'sandaly',
    shoesColor: 8,
  },
];

/** The journey: the six big things a bud does in the game, each stop with a bit of Buds trivia. */
const STOPS: TrailStop[] = [
  {
    id: 'start',
    kicker: 'Przystanek 1 · Początek',
    title: 'Wszystko zaczyna się na wyspie',
    text: 'Twój Bud budzi się na Wyspie Startowej. Zanim łódź zabierze go do miasta, nauczy się chodzić, rozmawiać i walczyć. To przygoda, a nie nudny samouczek.',
    fact: 'Pierwszy rywal to Manekin treningowy na ringu Trenerki Ewy. Dopiero po tej walce Kapitan Bosman zabiera cię w rejs.',
    src: '/screens/wyspa.png',
    alt: 'Wyspa Startowa w grze Buds',
  },
  {
    id: 'zadania',
    kicker: 'Przystanek 2 · Zadania',
    title: 'Każdy mieszkaniec ma swoją sprawę',
    text: `${CONTENT.quests.length} zadań od ${CONTENT.npcs.length} mieszkańców: zgubiony pies, zakupy dla sąsiadki, zaginione listy, kokosy dla baru. Każde daje doświadczenie, a niektóre przedmiot, którego nie kupisz w żadnym sklepie.`,
    fact: 'Pani Halina z Miasta Ziomków lubi przypominać, że „za jej czasów to się chodziło piechotą”.',
    src: '/screens/zadania.png',
    alt: 'Rozmowa z mieszkańcem i zadanie w grze Buds',
  },
  {
    id: 'pojedynki',
    kicker: 'Przystanek 3 · Pojedynki',
    title: 'Walka, w której liczy się głowa',
    text: 'Pojedynki są turowe: wybierasz ruch, przeciwnik odpowiada. Na twoje ruchy wpływa to, co trzymasz w ręku. Wygrana daje łup, od zwykłego po legendarny.',
    fact: 'Mikrofon to też broń. Z nim w ręku walczysz ruchami Diss, Bit i Drop, a deskorolką robisz Kickflip.',
    src: '/screens/pojedynek.png',
    alt: 'Pojedynek turowy w grze Buds',
  },
  {
    id: 'odkrywanie',
    kicker: 'Przystanek 4 · Odkrywanie',
    title: 'Świat pełen sekretów',
    text: `Cztery dzielnice z własnym klimatem, budynki, do których da się wejść, i ${CONTENT.caches.length} ukrytych skrytek z monetami. Skrytki widać dopiero z bliska, a mapa odsłania się tam, gdzie twój Bud już był.`,
    fact: 'Na Wzgórzu zakopano kuferek ze starym listem: „Dla tego, kto słucha, co mówią znaki”.',
    src: '/screens/skrytka.png',
    alt: 'Odkryta skrytka w grze Buds',
  },
  {
    id: 'sprzet',
    kicker: 'Przystanek 5 · Sprzęt i wierzchowce',
    title: 'Od czapki po quada',
    text: 'Dziewięć miejsc na ekwipunek, ponad sto przedmiotów i wierzchowce: deskorolka, rower, motocykl. Każda rzecz coś daje, a najlepsze zdobywasz w walce. Za prawdziwe pieniądze kupisz tylko wygląd, nigdy przewagę.',
    fact: 'Ryk Motocykla Grzmot podobno słychać w trzech dzielnicach naraz.',
    src: '/screens/ekwipunek.png',
    alt: 'Ekwipunek Buda w grze Buds',
  },
  {
    id: 'trening',
    kicker: 'Przystanek 6 · Trening',
    title: 'Trenuj, aż zostaniesz legendą',
    text: 'Worek treningowy, scena freestyle, fala do surfowania, szachy w ogrodzie. Krótkie mini-gry podnoszą umiejętności, a wyższe rangi odblokowują ruchy specjalne.',
    fact: 'Graffiti ćwiczysz na ścianie pod garażami. Tylko uważaj: dla Sierżanta Nowaka graffiti to wandalizm, „tak przynajmniej mówi regulamin”.',
    src: '/screens/trening.png',
    alt: 'Mini-gra treningowa w grze Buds',
  },
];

/** A look around the world: the four districts and the rooms inside. */
const SHOTS: Shot[] = [
  {
    id: 'miasto',
    label: 'Miasto Ziomków',
    title: 'Miasto, które cię zna',
    text: 'Rynek z fontanną, skatepark, stadion i działki. Tu mieszkańcy pierwsi powiedzą ci „cześć”.',
    src: '/screens/miasto.png',
  },
  {
    id: 'las-palmas',
    label: 'Las Palmas',
    title: 'Słońce, fale i dżungla',
    text: 'Miasteczko na palach, laguna flamingów i ruiny za wodospadem.',
    src: '/screens/las-palmas.png',
  },
  {
    id: 'dwor-carski',
    label: 'Dwór Carski',
    title: 'Elegancja z tajemnicą',
    text: 'Różany ogród, labirynt i urzędnicy, którym lepiej nie ufać.',
    src: '/screens/dwor-carski.png',
  },
  {
    id: 'los-karkos',
    label: 'Los Karkos',
    title: 'Tu nikt nie pyta dwa razy',
    text: 'Bloki, złomowisko i ring. Najtwardsi przeciwnicy, najlepszy łup.',
    src: '/screens/los-karkos.png',
  },
  {
    id: 'wnetrza',
    label: 'Wnętrza',
    title: 'Zajrzyj do środka',
    text: 'Kawiarnia, siłownia, salon dworku. W środku czekają mieszkańcy i niejedna skrytka.',
    src: '/screens/wnetrza.png',
  },
];

export default function HomePage() {
  const [initial] = sampleLooks(1, 11);

  return (
    <main className="journey">
      <ScrollProgress />

      {/* ---------- prolog ---------- */}
      <section className="hero container">
        <div className="hero-copy">
          <Reveal>
            <p className="eyebrow">Mobilne RPG · wczesny dostęp</p>
          </Reveal>
          <Reveal delay={80}>
            <h1>
              Znajdź swojego <span className="hl">ziomka</span>.
            </h1>
          </Reveal>
          <Reveal delay={160}>
            <p className="lead">
              Stwórz Buda z charakterem, obudź się na wyspie i wyrusz w podróż: zadania od
              mieszkańców, pojedynki, ukryte skrytki i sprzęt, który naprawdę coś daje.
            </p>
          </Reveal>
          <Reveal delay={240}>
            <div className="hero-actions">
              <Link href="#kreator" className="btn btn-primary btn-big">
                Stwórz Buda
              </Link>
              <Link href="#podroz" className="btn btn-big">
                Zacznij podróż
              </Link>
            </div>
          </Reveal>
        </div>

        <Reveal from="zoom" delay={120}>
          <div className="crew" aria-hidden>
            <div className="crew-sun" />
            <div className="crew-cloud crew-cloud-a" />
            <div className="crew-cloud crew-cloud-b" />
            {CREW.map((look, i) => (
              <div
                key={i}
                className={`crew-bud crew-bud-${i}`}
                style={{ '--i': i } as CSSProperties}
              >
                <BudSprite look={look} height={i === 2 ? 230 : i % 2 ? 190 : 205} />
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* ---------- podróż ---------- */}
      <section className="container section" id="podroz">
        <Reveal>
          <p className="eyebrow">Podróż</p>
          <h2 className="section-title">Droga przez świat Buds</h2>
          <p className="lead section-lead">
            Sześć przystanków, sześć przygód. Zobacz, co czeka na twojego Buda.
          </p>
        </Reveal>
        <Trail stops={STOPS} walker={CREW[1]!} />
      </section>

      {/* ---------- rozgrywka ---------- */}
      <section className="container section" id="rozgrywka">
        <Reveal>
          <p className="eyebrow">Rozgrywka</p>
          <h2 className="section-title">Zajrzyj do świata</h2>
        </Reveal>
        <Reveal delay={100}>
          <GameplayTabs shots={SHOTS} />
        </Reveal>
      </section>

      {/* ---------- twój bud ---------- */}
      <section className="container section" id="kreator">
        <Reveal>
          <p className="eyebrow">Twój Bud</p>
          <h2 className="section-title">Kto wyruszy w tę podróż?</h2>
        </Reveal>
        <Reveal delay={100}>{initial && <Creator initialLook={initial} />}</Reveal>
      </section>

      {/* ---------- epilog ---------- */}
      <section className="container section">
        <Reveal from="zoom">
          <div className="cta-band card">
            <div>
              <p className="eyebrow eyebrow-dark">Epilog</p>
              <h2>Twoja legenda zostaje z tobą</h2>
              <p className="muted">
                Załóż konto e-mailem i hasłem: Bud, postępy, ekwipunek i monety są bezpieczne na
                każdym urządzeniu. W grze wybierz „Zaloguj się na konto” i graj dalej, gdziekolwiek
                jesteś.
              </p>
            </div>
            <div className="cta-actions">
              <Link href="/konto" className="btn btn-primary btn-big">
                Załóż konto
              </Link>
              <Image
                src="/buds-icon.png"
                alt=""
                width={120}
                height={120}
                className="cta-icon"
                aria-hidden
              />
            </div>
          </div>
        </Reveal>
      </section>
    </main>
  );
}
