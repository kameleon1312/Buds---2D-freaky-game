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
import { GameplayTabs, Parallax, type Shot } from '@/components/JourneyBits';
import { Reveal } from '@/components/Reveal';
import { Trail, type TrailProp, type TrailStop } from '@/components/Trail';
import { plural } from '@/lib/plural';

/** Hand-picked crew for the hero: varied genders, moods, styles and skin tones. */
const CREW: BudLook[] = [
  {
    gender: 'ona',
    mood: 'radosny',
    skin: 1,
    hair: 'koczki',
    hairColor: 6,
    outfit: 'jersey',
    outfitColor: 7,
    accent: 3,
    pants: 'spodnica',
    pantsColor: 0,
    shoes: 'trampki',
    shoesColor: 3,
    mark: 'piegi',
  },
  {
    gender: 'on',
    mood: 'zadziorny',
    skin: 4,
    hair: 'undercut',
    hairColor: 0,
    outfit: 'bluza',
    outfitColor: 0,
    print: 'odznaka',
    accent: 6,
    pants: 'szerokie',
    pantsColor: 1,
    shoes: 'wysokie',
    shoesColor: 1,
    accessory: 'lancuch',
  },
  {
    gender: 'ona',
    mood: 'zadziorny',
    skin: 2,
    hair: 'dlugie',
    hairColor: 4,
    outfit: 'jeansowka',
    outfitColor: 6,
    accent: 3,
    pants: 'rurki',
    pantsColor: 1,
    shoes: 'kozaki',
    shoesColor: 6,
    glasses: 'lenonki',
  },
  {
    gender: 'on',
    mood: 'wyluzowany',
    skin: 0,
    hair: 'czapka',
    hairColor: 3,
    outfit: 'puchowka',
    outfitColor: 4,
    accent: 2,
    pants: 'bojowki',
    pantsColor: 4,
    shoes: 'glany',
    shoesColor: 6,
    accessory: 'plecak',
    glasses: 'przeciwsloneczne',
  },
  {
    gender: 'ona',
    mood: 'niesmialy',
    skin: 5,
    hair: 'afro',
    hairColor: 0,
    outfit: 'ogrodniczki',
    outfitColor: 7,
    accent: 5,
    pants: 'jeansy',
    pantsColor: 3,
    shoes: 'sandaly',
    shoesColor: 8,
  },
];

const look = (l: Partial<BudLook>): BudLook => ({ ...CREW[0]!, mark: 'brak', ...l });

/** People met on the road. */
const NEIGHBOUR = look({
  gender: 'ona',
  mood: 'radosny',
  hair: 'kok',
  hairColor: 9,
  skin: 6,
  outfit: 'sweter',
  outfitColor: 13,
  accent: 11,
  pants: 'chinosy',
  pantsColor: 2,
  shoes: 'mokasyny',
  shoesColor: 6,
  glasses: 'okulary',
});
const KID = look({
  gender: 'on',
  mood: 'niesmialy',
  hair: 'grzywka',
  hairColor: 2,
  skin: 1,
  outfit: 'tshirt',
  outfitColor: 4,
  print: 'gwiazda',
  accent: 7,
  pants: 'szorty',
  pantsColor: 3,
  shoes: 'trampki',
  shoesColor: 2,
});
const RIVAL = look({
  gender: 'on',
  mood: 'zadziorny',
  hair: 'irokez',
  hairColor: 3,
  skin: 3,
  outfit: 'kamizelka',
  outfitColor: 6,
  accent: 3,
  pants: 'bojowki',
  pantsColor: 1,
  shoes: 'glany',
  shoesColor: 1,
  mark: 'blizna',
});
const BANDIT = look({
  gender: 'on',
  mood: 'tajemniczy',
  hair: 'daszek',
  hairColor: 0,
  skin: 2,
  outfit: 'flanela',
  outfitColor: 11,
  accent: 6,
  pants: 'jeansy',
  pantsColor: 1,
  shoes: 'glany',
  shoesColor: 6,
  mark: 'zarost',
});
const FRIEND_A = look({
  gender: 'ona',
  mood: 'radosny',
  hair: 'kitki',
  hairColor: 7,
  skin: 2,
  outfit: 'dresowka',
  outfitColor: 2,
  accent: 8,
  pants: 'dresy',
  pantsColor: 1,
  shoes: 'biegowe',
  shoesColor: 5,
});
const FRIEND_B = look({
  gender: 'on',
  mood: 'wyluzowany',
  hair: 'dredy',
  hairColor: 0,
  skin: 5,
  outfit: 'polo',
  outfitColor: 10,
  accent: 8,
  pants: 'chinosy',
  pantsColor: 2,
  shoes: 'trampki',
  shoesColor: 0,
  accessory: 'nerka',
});

/** What stands along the road before each stop, and at the finish. All of it is the game's own art. */
const SCENES: TrailProp[][] = [
  // the island: the walker starts between the palms; the boat waits
  [
    { art: 'palm-a', size: [326, 394], w: 170, x: 0.24, y: 40, phone: true },
    { art: 'parasol-a', size: [163, 202], w: 96, x: 0.38, y: 30 },
    { art: 'lezak-a', size: [115, 96], w: 76, x: 0.46, y: 12 },
    { art: 'lodz', size: [307, 154], w: 210, x: 0.88, y: -20 },
    { art: 'palm-b', size: [326, 394], w: 180, x: 0.6, y: 50 },
    { art: 'krab', size: [86, 58], w: 46, x: 0.56, y: -80 },
    { art: 'muszle', size: [66, 36], w: 40, x: 0.32, y: -76 },
  ],
  // the town and its people
  [
    { art: 'kamienica-a', size: [557, 528], w: 230, x: 0.16, y: 42 },
    { art: 'lamp', size: [122, 250], w: 62, x: 0.31, y: 40 },
    { art: 'house-teal', size: [557, 422], w: 230, x: 0.46, y: 42 },
    { art: 'kawiarnia', size: [557, 365], w: 230, x: 0.7, y: 42 },
    { art: 'kamienica-cegla-a', size: [557, 518], w: 230, x: 0.9, y: 42 },
    { bud: NEIGHBOUR, w: 62, x: 0.36, y: -158, say: 'Pies mi uciekł! Pomożesz?', phone: true },
    { bud: KID, w: 54, x: 0.62, y: -158, say: 'Za skrytkę dam ci kartę!' },
    { art: 'hydrant', size: [67, 86], w: 38, x: 0.5, y: -96 },
    { art: 'bench', size: [173, 106], w: 96, x: 0.8, y: -96 },
  ],
  // the night street: a rival steps onto the road
  [
    { art: 'graffiti-c', size: [317, 211], w: 200, x: 0.16, y: 42 },
    { art: 'beczka-ogien', size: [86, 144], w: 60, x: 0.3, y: 40 },
    { art: 'graffiti-e', size: [317, 211], w: 200, x: 0.45, y: 42 },
    { art: 'ring', size: [538, 566], w: 220, x: 0.74, y: 44 },
    { art: 'worek-bokserski', size: [120, 240], w: 70, x: 0.9, y: 40 },
    { art: 'opony', size: [96, 115], w: 58, x: 0.6, y: 40 },
    { bud: RIVAL, w: 66, x: 0.5, y: -6, event: 'fight', phone: true },
  ],
  // the wasteland: someone sits in the bushes
  [
    { art: 'drzewo-suche', size: [173, 250], w: 120, x: 0.16, y: 42 },
    { art: 'zlom', size: [326, 240], w: 190, x: 0.34, y: 42 },
    { art: 'rock-a', size: [125, 96], w: 80, x: 0.5, y: 40 },
    { art: 'wrak-a', size: [307, 173], w: 190, x: 0.66, y: 42 },
    { art: 'sosna', size: [154, 326], w: 100, x: 0.84, y: 42 },
    { art: 'sign', size: [154, 173], w: 70, x: 0.92, y: 38 },
    { bud: BANDIT, w: 60, x: 0.58, y: -108, event: 'ambush', phone: true },
    { art: 'bush-a', size: [134, 110], w: 110, x: 0.58, y: -126 },
    { art: 'kloda', size: [317, 144], w: 130, x: 0.26, y: -112 },
  ],
  // the district: it gets built as the walker passes, one building at a time
  [
    { art: 'dz-na-sprzedaz', size: [211, 211], w: 110, x: 0.12, y: 40 },
    { art: 'dz-budowa', size: [346, 451], w: 130, x: 0.25, y: 42 },
    { art: 'dz-las-ratusz-1', size: [365, 307], w: 170, x: 0.39, y: 42, phone: true },
    { art: 'dz-las-szklarnia', size: [346, 432], w: 130, x: 0.53, y: 42 },
    { art: 'dz-las-apartamentowiec', size: [346, 566], w: 140, x: 0.66, y: 42 },
    { art: 'dz-las-ratusz-3', size: [374, 816], w: 130, x: 0.79, y: 42 },
    { art: 'dz-las-iglica', size: [557, 1229], w: 170, x: 0.92, y: 42 },
    { art: 'dz-las-fontanna', size: [355, 336], w: 110, x: 0.46, y: -96 },
    { art: 'dz-las-farma-solarna', size: [346, 278], w: 130, x: 0.72, y: -76 },
  ],
  // together: a crowd in front of the stage, two of them come along
  [
    { art: 'scena', size: [710, 374], w: 330, x: 0.24, y: 42 },
    { art: 'trybuna', size: [893, 298], w: 360, x: 0.72, y: 42 },
    { bud: CREW[0]!, w: 54, x: 0.42, y: -158, say: 'Hej! Co tam?' },
    { bud: FRIEND_A, w: 56, x: 0.52, y: -158, say: 'Idziemy z tobą!', event: 'join', phone: true },
    { bud: FRIEND_B, w: 56, x: 0.6, y: -122, event: 'join' },
    { bud: CREW[3]!, w: 54, x: 0.72, y: -158, say: 'Bierzemy ten rewir?' },
    { art: 'lamp', size: [122, 250], w: 62, x: 0.9, y: 40 },
  ],
  // the finish
  [
    { art: 'palm-c', size: [326, 394], w: 170, x: 0.2, y: 20 },
    { art: 'fontanna', size: [326, 278], w: 170, x: 0.42, y: 20 },
    { art: 'tree-a', size: [230, 288], w: 130, x: 0.8, y: 20 },
  ],
];

/** The journey: the six big things a bud does in the game, each stop with a bit of true Buds trivia. */
const STOPS: TrailStop[] = [
  {
    id: 'start',
    biome: 'wyspa',
    title: 'Wszystko zaczyna się na wyspie',
    text: 'Twój Bud budzi się na Wyspie Startowej. Zanim łódź zabierze go do miasta, nauczy się chodzić, rozmawiać i walczyć. To przygoda, a nie nudny samouczek.',
    fact: 'Pierwszy rywal to Manekin treningowy na ringu Trenerki Ewy. Dopiero po tej walce Kapitan Bosman zabiera cię w rejs.',
    src: '/screens/wyspa.png',
    alt: 'Wyspa Startowa w grze Buds',
  },
  {
    id: 'zadania',
    biome: 'miasto',
    title: 'Każdy mieszkaniec ma swoją sprawę',
    text: `${CONTENT.quests.length} zadań od ${CONTENT.npcs.length} mieszkańców: zgubiony pies, zakupy dla sąsiadki, zaginione listy, kokosy dla baru. Każde daje doświadczenie, a niektóre przedmiot, którego nie kupisz w żadnym sklepie.`,
    fact: 'Pani Halina z Miasta Ziomków lubi przypominać, że „za jej czasów to się chodziło piechotą”.',
    src: '/screens/zadania.png',
    alt: 'Rozmowa z mieszkańcem i zadanie w grze Buds',
  },
  {
    id: 'pojedynki',
    biome: 'noc',
    title: 'Bijesz się tu i teraz, na ulicy',
    text: 'Walka toczy się na żywo, tam gdzie stoisz, bez osobnej areny. Pięć przycisków, uniki, tarcze i ciosy, które sam dobierasz i ulepszasz. Na mapie stoją rywale, w krzakach czają się zasadzki, a od poziomu 6 możesz zmierzyć się z innymi graczami.',
    fact: 'Mikrofon to też broń. Z nim w ręku walczysz ruchami Diss, Bit i Drop, a deskorolką robisz Kickflip.',
    src: '/screens/pojedynek.png',
    alt: 'Walka na ulicy w grze Buds',
  },
  {
    id: 'podroze',
    biome: 'pustkowie',
    title: 'Drogą przez pustkowia',
    text: `${DISTRICTS.length} ${plural(DISTRICTS.length, 'miasto', 'miasta', 'miast')}, a między nimi ${ROUTES.length} ${plural(ROUTES.length, 'pustkowie', 'pustkowia', 'pustkowi')}, które przechodzisz bez ekranu ładowania: miasto płynnie zamienia się w las, wydmy, sady albo złomowisko. Trzymaj się drogi, bo w krzakach czekają zasadzki. Wolisz wygodniej? Z ${PORTS.length} przystani pływają promy.`,
    fact: 'Na Wydmach rządzi Król Wydm. Jego zasada jest prosta: „Za przejście płaci się koroną”.',
    src: '/screens/podroze.png',
    alt: 'Pustkowie między miastami w grze Buds',
  },
  {
    id: 'dystrykty',
    biome: 'dystrykt',
    title: 'Zbuduj imperium od zera',
    text: `Na pustkowiach leży tylko ${PLOTS.length} ${plural(PLOTS.length, 'działka', 'działki', 'działek')}. Kup jedną, nadaj nazwę i zacznij od małego placu z ratuszem. Wycinaj las, stawiaj bloki, farmy i betoniarnie, zbieraj czynsz. Każda działka wygląda jak jej okolica: drewno w lesie, biały tynk i palmy na wydmach, cegła przy dworze, blacha na złomowisku.`,
    fact: `Najwyższa ranga dystryktu to ${RANKS[RANKS.length - 1]!.name}. Znakiem największych jest Iglica, wieżowiec widoczny z całego pustkowia.`,
    src: '/screens/dystrykt.png',
    alt: 'Dystrykt gracza na działce przy drodze w grze Buds',
  },
  {
    id: 'razem',
    biome: 'razem',
    title: 'Ulice pełne prawdziwych ludzi',
    text: 'Na mapie spotykasz innych graczy na żywo: piszesz na czacie, wyzywasz ich na walkę i trzymasz się z ekipą. W Rewirach co tydzień walczycie o wpływy w każdej strefie miasta, a od poziomu 6 możecie napadać na swoje dystrykty. Im większy dystrykt, tym trudniej go zdobyć.',
    fact: 'Kto rządzi rewirem, codziennie zbiera haracz, a zwycięzcy tygodnia zatrzymują swój tytuł na zawsze.',
    src: '/screens/rewiry.png',
    alt: 'Rewiry i rywalizacja graczy w grze Buds',
  },
];

/** How a bud grows: gear, rides, training. Each one has something of the game stepping out of its picture. */
const GROWTH = [
  {
    id: 'ekwipunek',
    title: 'Ekwipunek od stóp do głów',
    text: `Dziewięć miejsc na ciele i ponad ${Math.floor(GEAR_ITEMS.length / 10) * 10} przedmiotów. Każda rzecz coś daje i widać to od razu w walce. Za prawdziwe pieniądze kupisz tylko wygląd, nigdy przewagę.`,
    src: '/screens/ekwipunek.png',
    art: { src: '/world/tr-rekawica.png', w: 144, h: 116 },
  },
  {
    id: 'pojazdy',
    title: 'Pojazdy',
    text: 'Deskorolka, hulajnoga i rower ze sklepu, a motocykl i quad z walk. Na pojeździe jedziesz szybciej i w dowolną stronę.',
    src: '/screens/pojazdy.png',
    art: { src: '/world/jazda-motocykl-bok.png', w: 192, h: 115 },
  },
  {
    id: 'trening',
    title: 'Trening jak prawdziwe zadania',
    text: 'Uciekasz na desce przed rekinem, sparujesz w ringu, malujesz mural z pamięci, śledzisz kulkę pod kubkami ulicznego cwaniaka, nawijasz zwrotkę na scenie i wiejesz przed psem. Rangi 3 i 5 odblokowują wyjątkowe zdolności.',
    src: '/screens/trening.png',
    art: { src: '/world/tr-rekin.png', w: 260, h: 248 },
  },
];

/** A look around the world: the cities, the wastelands and the rooms inside, each with its own look. */
const SHOTS: Shot[] = [
  {
    id: 'miasto',
    label: 'Miasto Ziomków',
    title: 'Miasto, które cię zna',
    text: 'Rynek z fontanną, skatepark, garaże z graffiti i park ze stawem. Mieszkańcy pierwsi powiedzą ci „cześć”.',
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
    text: 'Turkusowa woda, plaże z krabami, laguna flamingów i ruiny za wodospadem.',
    src: '/screens/las-palmas.png',
  },
  {
    id: 'dwor-carski',
    label: 'Dwór Carski',
    title: 'Elegancja z tajemnicą',
    text: 'Koszone trawniki, różany ogród, labirynt i stary młyn. I urzędnicy, którym lepiej nie ufać.',
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

/** The street of the hero: real buildings of the game, left to right. */
const STREET: { art: string; size: [number, number]; w: number }[] = [
  { art: 'blok-a', size: [749, 634], w: 330 },
  { art: 'kamienica-b', size: [557, 528], w: 250 },
  { art: 'sklep-kiosk', size: [557, 365], w: 230 },
  { art: 'kamienica-cegla-b', size: [557, 518], w: 250 },
  { art: 'kawiarnia', size: [557, 365], w: 240 },
  { art: 'house-red', size: [557, 422], w: 230 },
  { art: 'kamienica-c', size: [557, 528], w: 250 },
  { art: 'blok-b', size: [749, 634], w: 330 },
];

export default function HomePage() {
  return (
    <main className="journey">
      {/* ---------- prolog ---------- */}
      <section className="hero-town">
        <div className="hero-sun" aria-hidden />
        <div className="hero-cloud hero-cloud-a" aria-hidden />
        <div className="hero-cloud hero-cloud-b" aria-hidden />
        <div className="hero-cloud hero-cloud-c" aria-hidden />
        <div className="container hero-copy">
          <Reveal>
            <h1>
              Znajdź swojego <span className="hl">ziomka</span>.
            </h1>
          </Reveal>
          <Reveal delay={90}>
            <p className="lead">
              Stwórz Buda z charakterem i ruszaj w drogę: zadania od mieszkańców, walki na ulicy,
              pustkowia między miastami, własny dystrykt i inni gracze na żywo.
            </p>
          </Reveal>
          <Reveal delay={180}>
            <div className="hero-actions">
              <Link href="#kreator" className="btn btn-primary btn-big">
                Stwórz Buda
              </Link>
              <Link href="#podroz" className="btn btn-big">
                Zobacz drogę
              </Link>
            </div>
          </Reveal>
        </div>

        <div className="hero-scene" aria-hidden>
          <Parallax depth={0.06}>
            <div className="hero-street">
              {STREET.map((b) => (
                <Image
                  key={b.art}
                  src={`/world/${b.art}.png`}
                  alt=""
                  width={b.size[0]}
                  height={b.size[1]}
                  sizes={`${b.w * 2}px`}
                  style={{ width: b.w }}
                  priority
                />
              ))}
            </div>
          </Parallax>
          <div className="hero-pavement">
            <Image
              className="hero-lamp hero-lamp-a"
              src="/world/lamp.png"
              alt=""
              width={122}
              height={250}
            />
            <Image
              className="hero-lamp hero-lamp-b"
              src="/world/lamp.png"
              alt=""
              width={122}
              height={250}
            />
            <Image className="hero-tree" src="/world/tree-a.png" alt="" width={230} height={288} />
            <div className="hero-crew">
              {CREW.map((l, i) => (
                <div key={i} className="hero-bud" style={{ '--i': i } as CSSProperties}>
                  <BudSprite look={l} height={i === 2 ? 236 : i % 2 ? 214 : 224} />
                </div>
              ))}
            </div>
          </div>
          <div className="hero-road">
            <Image className="hero-car" src="/world/auto-a.png" alt="" width={307} height={173} />
          </div>
        </div>
      </section>

      {/* ---------- podróż ---------- */}
      <section className="section" id="podroz">
        <div className="container">
          <Reveal>
            <h2 className="section-title">Droga przez świat Buds</h2>
            <p className="lead section-lead">
              Idź razem z Budem. Przewijaj, a sam zobaczysz, co czeka po drodze.
            </p>
          </Reveal>
          <Trail stops={STOPS} walker={CREW[1]!} friends={[FRIEND_A, FRIEND_B]} scenes={SCENES} />
        </div>
      </section>

      {/* ---------- rozwój ---------- */}
      <section className="container section" id="rozwoj">
        <Reveal>
          <h2 className="section-title">Twój Bud rośnie razem z tobą</h2>
        </Reveal>
        <div className="growth">
          {GROWTH.map((g, i) => (
            <Reveal key={g.id} delay={i * 110} className={`growth-card growth-${g.id}`}>
              <div className="growth-shot">
                <Image
                  src={g.src}
                  alt={g.title}
                  width={1200}
                  height={521}
                  sizes="(max-width: 760px) 100vw, 640px"
                />
              </div>
              <Image
                className="growth-art"
                src={g.art.src}
                alt=""
                width={g.art.w}
                height={g.art.h}
                aria-hidden
              />
              <h3>{g.title}</h3>
              <p>{g.text}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---------- świat ---------- */}
      <section className="container section" id="swiat">
        <Reveal>
          <h2 className="section-title">Każde miejsce ma swój charakter</h2>
          <p className="lead section-lead">
            Inna woda, inne budynki, inni ludzie. Zajrzyj, jak wygląda każda dzielnica.
          </p>
        </Reveal>
        <Reveal delay={100}>
          <GameplayTabs shots={SHOTS} />
        </Reveal>
      </section>

      {/* ---------- twój bud ---------- */}
      <section className="container section" id="kreator">
        <Reveal>
          <h2 className="section-title">Kto wyruszy w tę podróż?</h2>
        </Reveal>
        <Reveal delay={100}>
          <Creator initialLook={FRIEND_A} />
        </Reveal>
      </section>

      {/* ---------- epilog ---------- */}
      <section className="container section">
        <Reveal from="zoom">
          <div className="cta-band card">
            <div>
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
