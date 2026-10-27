import type { CSSProperties } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  CONTENT,
  DISTRICTS,
  GEAR_ITEMS,
  PLOTS,
  PORTS,
  RANKS,
  ROUTES,
  type BudLook,
} from '@buds/shared';
import { BudSprite } from '@/components/BudSprite';
import { Creator } from '@/components/Creator';
import { CountUp, GameplayTabs, Parallax, type Shot } from '@/components/JourneyBits';
import { Reveal } from '@/components/Reveal';
import { Trail, type TrailStop } from '@/components/Trail';
import { sampleLooks } from '@/lib/looks';
import { plural } from '@/lib/plural';

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

/** The journey: the six big things a bud does in the game, each stop with a bit of true Buds trivia. */
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
    kicker: 'Przystanek 2 · Mieszkańcy',
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
    text: 'Pojedynki są turowe i rozgrywają się na nocnej ulicy, jak w filmie: kamera wjeżdża w cios, a mocne trafienie zwalnia czas. Ruchy zależą od tego, co trzymasz w ręku, a z treningiem uczysz się ich mocniejszych wersji.',
    fact: 'Mikrofon to też broń. Z nim w ręku walczysz ruchami Diss, Bit i Drop, a deskorolką robisz Kickflip.',
    src: '/screens/pojedynek.png',
    alt: 'Pojedynek turowy na nocnej ulicy w grze Buds',
  },
  {
    id: 'podroze',
    kicker: 'Przystanek 4 · Podróże',
    title: 'Drogą przez pustkowia',
    text: `${DISTRICTS.length} ${plural(DISTRICTS.length, 'miasto', 'miasta', 'miast')}, a między nimi ${ROUTES.length} ${plural(ROUTES.length, 'pustkowie', 'pustkowia', 'pustkowi')}, które przechodzisz bez ekranu ładowania: miasto płynnie zamienia się w las, wydmy, sady albo złomowisko. Trzymaj się drogi, bo w krzakach czekają zasadzki. Wolisz wygodniej? Z ${PORTS.length} przystani pływają promy.`,
    fact: 'Na Wydmach rządzi Król Wydm. Jego zasada jest prosta: „Za przejście płaci się koroną”.',
    src: '/screens/podroze.png',
    alt: 'Pustkowie między miastami w grze Buds',
  },
  {
    id: 'dystrykty',
    kicker: 'Przystanek 5 · Twój dystrykt',
    title: 'Zbuduj imperium od zera',
    text: `Na pustkowiach leży tylko ${PLOTS.length} ${plural(PLOTS.length, 'działka', 'działki', 'działek')}. Kup jedną, nadaj nazwę i zacznij od małego placu z ratuszem. Wycinaj las, stawiaj bloki, farmy i betoniarnie, zbieraj czynsz. Każda działka wygląda jak jej okolica: drewno w lesie, biały tynk i palmy na wydmach, cegła przy dworze, blacha na złomowisku.`,
    fact: `Najwyższa ranga dystryktu to ${RANKS[RANKS.length - 1]!.name}. Znakiem największych jest Iglica, wieżowiec widoczny z całego pustkowia.`,
    src: '/screens/dystrykt.png',
    alt: 'Dystrykt gracza na działce przy drodze w grze Buds',
  },
  {
    id: 'razem',
    kicker: 'Przystanek 6 · Razem',
    title: 'Ulice pełne prawdziwych ludzi',
    text: 'Na mapie spotykasz innych graczy na żywo: piszesz na czacie, wyzywasz ich na pojedynek i trzymasz się z ekipą. W Rewirach co tydzień walczycie o wpływy w każdej strefie miasta, a od poziomu 6 możecie napadać na swoje dystrykty. Im większy dystrykt, tym trudniej go zdobyć.',
    fact: 'Kto rządzi rewirem, codziennie zbiera haracz, a zwycięzcy tygodnia zatrzymują swój tytuł na zawsze.',
    src: '/screens/rewiry.png',
    alt: 'Rewiry i rywalizacja graczy w grze Buds',
  },
];

/** How a bud grows: gear, rides, training. */
const GROWTH = [
  {
    id: 'ekwipunek',
    title: 'Ekwipunek od stóp do głów',
    text: `Dziewięć miejsc na ciele i ponad ${Math.floor(GEAR_ITEMS.length / 10) * 10} przedmiotów. Każda rzecz coś daje i widać to od razu w walce. Za prawdziwe pieniądze kupisz tylko wygląd, nigdy przewagę.`,
    src: '/screens/ekwipunek.png',
  },
  {
    id: 'pojazdy',
    title: 'Pojazdy',
    text: 'Deskorolka, hulajnoga i rower ze sklepu, a motocykl i quad z pojedynków. Na pojeździe jedziesz szybciej i w dowolną stronę.',
    src: '/screens/pojazdy.png',
  },
  {
    id: 'trening',
    title: 'Trening',
    text: 'Sześć umiejętności i każda z własną mini-grą: rytm, kombinacje ciosów, szablon graffiti, fala, refleks. Rangi 3 i 5 odblokowują wyjątkowe zdolności.',
    src: '/screens/trening.png',
  },
];

/** A look around the world: the cities, the wastelands and the rooms inside, each with its own look. */
const SHOTS: Shot[] = [
  {
    id: 'miasto',
    label: 'Miasto Ziomków',
    title: 'Miasto, które cię zna',
    text: 'Rynek z fontanną, skatepark, garaże z graffiti i park ze stawem. Gołębie zrywają się spod nóg, a mieszkańcy pierwsi powiedzą ci „cześć”.',
    src: '/screens/miasto.png',
  },
  {
    id: 'dzika-puszcza',
    label: 'Dzika Puszcza',
    title: 'Las, który pamięta',
    text: 'Głębokie jezioro, bagna, obozowisko i ruiny strażnicy. Liście sypią się z drzew, a na polanach rosną grzyby.',
    src: '/screens/dzika-puszcza.png',
  },
  {
    id: 'las-palmas',
    label: 'Las Palmas',
    title: 'Słońce, fale i dżungla',
    text: 'Turkusowa woda, plaże z mewami i krabami, laguna flamingów i ruiny za wodospadem.',
    src: '/screens/las-palmas.png',
  },
  {
    id: 'dwor-carski',
    label: 'Dwór Carski',
    title: 'Elegancja z tajemnicą',
    text: 'Koszone trawniki, różany ogród, labirynt, stary młyn i łabędzie na jeziorze. I urzędnicy, którym lepiej nie ufać.',
    src: '/screens/dwor-carski.png',
  },
  {
    id: 'los-karkos',
    label: 'Los Karkos',
    title: 'Tu nikt nie pyta dwa razy',
    text: 'Bloki, złomowisko, ring i dym z beczek. Najtwardsi przeciwnicy i najlepszy łup.',
    src: '/screens/los-karkos.png',
  },
  {
    id: 'pustkowia',
    label: 'Pustkowia',
    title: 'Między miastami',
    text: 'Leśne Ostępy, Wydmy, Stary Gościniec i Nieużytki. Droga, zasadzki w krzakach i działki, na których rosną dystrykty graczy.',
    src: '/screens/pustkowia.png',
  },
  {
    id: 'wnetrza',
    label: 'Wnętrza',
    title: 'Zajrzyj do środka',
    text: 'Kawiarnia, siłownia, salon dworku. W środku czekają mieszkańcy i niejedna skrytka.',
    src: '/screens/wnetrza.png',
  },
];

/** The world in numbers (all counted from the game's own content). */
const STATS = [
  { value: DISTRICTS.length, label: plural(DISTRICTS.length, 'miasto', 'miasta', 'miast') },
  { value: ROUTES.length, label: plural(ROUTES.length, 'pustkowie', 'pustkowia', 'pustkowi') },
  {
    value: CONTENT.quests.length,
    label: plural(CONTENT.quests.length, 'zadanie', 'zadania', 'zadań'),
  },
  {
    value: CONTENT.caches.length,
    label: plural(CONTENT.caches.length, 'skrytka', 'skrytki', 'skrytek'),
  },
  {
    value: GEAR_ITEMS.length,
    label: plural(GEAR_ITEMS.length, 'przedmiot', 'przedmioty', 'przedmiotów'),
  },
];

export default function HomePage() {
  const [initial] = sampleLooks(1, 11);

  return (
    <main className="journey">
      {/* ---------- prolog ---------- */}
      <section className="hero container">
        <div className="hero-copy">
          <Reveal>
            <p className="eyebrow">Mobilne RPG · wczesny dostęp</p>
          </Reveal>
          <Reveal delay={90}>
            <h1>
              Znajdź swojego <span className="hl">ziomka</span>.
            </h1>
          </Reveal>
          <Reveal delay={180}>
            <p className="lead">
              Stwórz Buda z charakterem i ruszaj w drogę: zadania od mieszkańców, pojedynki na
              nocnej ulicy, pustkowia między miastami, własny dystrykt i inni gracze na żywo.
            </p>
          </Reveal>
          <Reveal delay={270}>
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

        <Reveal from="zoom" delay={140}>
          <Parallax>
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
          </Parallax>
        </Reveal>
      </section>

      {/* ---------- the world in numbers ---------- */}
      <section className="container world-stats-band" aria-label="Świat Buds w liczbach">
        <ul className="world-stats">
          {STATS.map((s, i) => (
            <Reveal as="li" key={s.label} delay={i * 70} className="world-stat">
              <strong>
                <CountUp value={s.value} />
              </strong>
              <span>{s.label}</span>
            </Reveal>
          ))}
        </ul>
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

      {/* ---------- rozwój ---------- */}
      <section className="container section" id="rozwoj">
        <Reveal>
          <p className="eyebrow">Rozwój</p>
          <h2 className="section-title">Twój Bud rośnie razem z tobą</h2>
        </Reveal>
        <div className="growth">
          {GROWTH.map((g, i) => (
            <Reveal key={g.id} delay={i * 110} className="growth-card card">
              <div className="growth-shot">
                <Image
                  src={g.src}
                  alt={g.title}
                  width={1200}
                  height={521}
                  sizes="(max-width: 760px) 100vw, 340px"
                />
              </div>
              <h3>{g.title}</h3>
              <p>{g.text}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---------- świat ---------- */}
      <section className="container section" id="swiat">
        <Reveal>
          <p className="eyebrow">Świat</p>
          <h2 className="section-title">Każde miejsce ma swój charakter</h2>
          <p className="lead section-lead">
            Inna woda, inne ptaki, inne budynki. Zajrzyj, jak wygląda każda dzielnica.
          </p>
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
                Załóż konto e-mailem i hasłem: Bud, postępy, ekwipunek, monety i dystrykt są
                bezpieczne na każdym urządzeniu. W grze wybierz „Zaloguj się na konto” i graj dalej,
                gdziekolwiek jesteś.
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
