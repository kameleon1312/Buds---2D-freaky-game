'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  ACCESSORIES,
  ACCESSORY_LABELS,
  BUD_NAME_MAX,
  EYE_COLORS,
  FACE_MARKS_BY_GENDER,
  FACE_MARK_LABELS,
  GENDERS,
  GENDER_LABELS,
  GLASSES,
  GLASSES_LABELS,
  HAIR_BY_GENDER,
  HAIR_COLORS,
  HAIR_LABELS,
  MOODS,
  moodBlurb,
  OUTFITS_BY_GENDER,
  OUTFIT_COLORS,
  OUTFIT_LABELS,
  PANTS_BY_GENDER,
  PANTS_COLORS,
  PANTS_LABELS,
  PRINTS,
  PRINT_LABELS,
  SHOES_BY_GENDER,
  SHOES_COLORS,
  SHOES_LABELS,
  SKINS,
  budNameSchema,
  moodLabel,
  randomLook,
  type BudLook,
  type Gender,
} from '@buds/shared';
import { createBud } from '@/lib/api';
import { accessToken } from '@/lib/supabase';
import { savePlayer } from '@/lib/player';
import { BudPreview } from './BudPreview';
import { BudSprite, type BudCrop } from './BudSprite';

/** The creator shows one group of choices at a time, so it fits on one screen. */
type Tab = 'zestawy' | 'postac' | 'wlosy' | 'twarz' | 'gora' | 'dol' | 'buty' | 'dodatki';

const TABS: { id: Tab; label: string; crop: BudCrop | 'whole' }[] = [
  { id: 'zestawy', label: 'Zestawy', crop: 'whole' },
  { id: 'postac', label: 'Postać', crop: 'head' },
  { id: 'wlosy', label: 'Włosy', crop: 'hair' },
  { id: 'twarz', label: 'Twarz', crop: 'face' },
  { id: 'gora', label: 'Góra', crop: 'torso' },
  { id: 'dol', label: 'Dół', crop: 'legs' },
  { id: 'buty', label: 'Buty', crop: 'feet' },
  { id: 'dodatki', label: 'Dodatki', crop: 'torso' },
];

/** Whole outfits, one tap: what a bud of this crowd would wear. Colours are indexes of the palettes. */
const SETS: { id: string; label: string; look: Partial<BudLook> }[] = [
  {
    id: 'uliczny',
    label: 'Uliczny',
    look: {
      outfit: 'bluza',
      outfitColor: 6,
      print: 'odznaka',
      accent: 0,
      pants: 'szerokie',
      pantsColor: 1,
      shoes: 'wysokie',
      shoesColor: 0,
      accessory: 'lancuch',
      glasses: 'brak',
    },
  },
  {
    id: 'sportowy',
    label: 'Sportowy',
    look: {
      outfit: 'dresowka',
      outfitColor: 3,
      print: 'gladka',
      accent: 7,
      pants: 'dresy',
      pantsColor: 1,
      shoes: 'biegowe',
      shoesColor: 3,
      accessory: 'nerka',
      glasses: 'sportowe',
    },
  },
  {
    id: 'rockowy',
    label: 'Rockowy',
    look: {
      outfit: 'jeansowka',
      outfitColor: 6,
      print: 'gladka',
      accent: 3,
      pants: 'rurki',
      pantsColor: 1,
      shoes: 'glany',
      shoesColor: 1,
      accessory: 'lancuch',
      glasses: 'przeciwsloneczne',
    },
  },
  {
    id: 'szkolny',
    label: 'Szkolny',
    look: {
      outfit: 'sweter',
      outfitColor: 12,
      print: 'gladka',
      accent: 8,
      pants: 'chinosy',
      pantsColor: 2,
      shoes: 'mokasyny',
      shoesColor: 6,
      accessory: 'plecak',
      glasses: 'okulary',
    },
  },
  {
    id: 'plazowy',
    label: 'Plażowy',
    look: {
      outfit: 'tshirt',
      outfitColor: 7,
      print: 'paski',
      accent: 1,
      pants: 'szorty',
      pantsColor: 3,
      shoes: 'sandaly',
      shoesColor: 6,
      accessory: 'brak',
      glasses: 'lenonki',
    },
  },
  {
    id: 'gorski',
    label: 'Na szlak',
    look: {
      outfit: 'puchowka',
      outfitColor: 4,
      print: 'gladka',
      accent: 6,
      pants: 'bojowki',
      pantsColor: 4,
      shoes: 'glany',
      shoesColor: 6,
      accessory: 'plecak',
      glasses: 'brak',
    },
  },
  {
    id: 'kibic',
    label: 'Kibic',
    look: {
      outfit: 'jersey',
      outfitColor: 1,
      print: 'gladka',
      accent: 8,
      pants: 'dresy',
      pantsColor: 0,
      shoes: 'trampki',
      shoesColor: 0,
      accessory: 'szalik',
      glasses: 'brak',
    },
  },
  {
    id: 'farmer',
    label: 'Ogrodnik',
    look: {
      outfit: 'ogrodniczki',
      outfitColor: 7,
      print: 'gladka',
      accent: 5,
      pants: 'jeansy',
      pantsColor: 3,
      shoes: 'kalosze',
      shoesColor: 4,
      accessory: 'brak',
      glasses: 'brak',
    },
  },
];

/** Every part stays only if the gender's catalog has it; otherwise its first pick. */
function forGender(look: BudLook, g: Gender): BudLook {
  const keep = <T,>(list: readonly T[], v: T) => (list.includes(v) ? v : list[0]!);
  return {
    ...look,
    gender: g,
    hair: keep(HAIR_BY_GENDER[g], look.hair),
    outfit: keep(OUTFITS_BY_GENDER[g], look.outfit),
    pants: keep(PANTS_BY_GENDER[g], look.pants),
    shoes: keep(SHOES_BY_GENDER[g], look.shoes),
    mark: keep(FACE_MARKS_BY_GENDER[g], look.mark ?? 'brak'),
  };
}

function Swatches({
  colors,
  value,
  onChange,
  label,
  auto,
}: {
  colors: readonly string[];
  value: number;
  onChange: (i: number) => void;
  label: string;
  /** an extra first choice meaning "pick one that goes with the rest" (value -1) */
  auto?: string;
}) {
  return (
    <div className="swatches" role="radiogroup" aria-label={label}>
      {auto && (
        <button
          type="button"
          role="radio"
          aria-checked={value < 0}
          aria-label={auto}
          title={auto}
          className="swatch swatch-auto"
          onClick={() => onChange(-1)}
        >
          A
        </button>
      )}
      {colors.map((c, i) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value === i}
          aria-label={`${label} ${i + 1}`}
          className="swatch"
          style={{ background: c }}
          onClick={() => onChange(i)}
        />
      ))}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <fieldset className="field">
      <legend className="field-label">{label}</legend>
      {children}
    </fieldset>
  );
}

/** A choice shown as what it really looks like on this bud. */
function Tile<T extends string>({
  id,
  label,
  selected,
  look,
  crop,
  onPick,
}: {
  id: T;
  label: string;
  selected: boolean;
  look: BudLook;
  crop?: BudCrop;
  onPick: (id: T) => void;
}) {
  return (
    <button type="button" className="tile" aria-pressed={selected} onClick={() => onPick(id)}>
      <span className="tile-pic">
        <BudSprite look={look} height={crop ? 64 : 110} crop={crop} />
      </span>
      <span className="tile-label">{label}</span>
    </button>
  );
}

export function Creator({ initialLook }: { initialLook: BudLook }) {
  const router = useRouter();
  const [look, setLook] = useState<BudLook>(initialLook);
  const [history, setHistory] = useState<BudLook[]>([]);
  const [name, setName] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('zestawy');
  /** Which way the bud was turned by hand; null: it turns and walks by itself. */
  const [spin, setSpin] = useState<number | null>(null);
  /** Bumped by every change: the bud gives a little hop. */
  const [changes, setChanges] = useState(0);

  const put = (next: BudLook) => {
    setHistory((h) => [...h.slice(-19), look]);
    setLook(next);
    setChanges((c) => c + 1);
  };
  const update = (patch: Partial<BudLook>) => put({ ...look, ...patch });
  const nameCheck = budNameSchema.safeParse(name);
  const accent = look.accent ?? -1;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!nameCheck.success) {
      setError(nameCheck.error.issues[0]?.message ?? 'Sprawdź imię');
      return;
    }
    setPending(true);
    setError(null);
    try {
      // signed in: the bud goes straight into the account
      const { bud, token } = await createBud({ name: nameCheck.data, look }, await accessToken());
      savePlayer({ slug: bud.slug, token });
      router.push(`/b/${bud.slug}?nowy=1`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się. Spróbuj ponownie.');
      setPending(false);
    }
  }

  return (
    <form className="creator" onSubmit={onSubmit} noValidate>
      <div className="creator-preview">
        <div className="dressing">
          <Image
            className="dressing-shop"
            src="/world/sklep-ciuchy.png"
            alt=""
            width={557}
            height={365}
            sizes="420px"
          />
          <div className="dressing-ground" aria-hidden />
          <p className="dressing-bubble" key={`${look.mood}-${look.gender}`}>
            {moodBlurb(look.mood, look.gender)}
          </p>
          <div className="dressing-bud" key={changes}>
            <BudPreview look={look} name={name || 'Twój Bud'} height={300} spin={spin} />
          </div>
          <div className="dressing-turn">
            <button
              type="button"
              className="turn"
              aria-label="Obróć w lewo"
              onClick={() => setSpin(((spin ?? 0) + 3) % 4)}
            >
              <span aria-hidden>‹</span>
            </button>
            <button
              type="button"
              className="turn"
              aria-label="Obróć w prawo"
              onClick={() => setSpin(((spin ?? 0) + 1) % 4)}
            >
              <span aria-hidden>›</span>
            </button>
          </div>
        </div>

        <label className="nameplate">
          <span className="visually-hidden">Imię</span>
          <input
            className="nameplate-input"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            maxLength={BUD_NAME_MAX}
            placeholder="Jak ma na imię?"
            autoComplete="nickname"
          />
          <span className="nameplate-mood">{moodLabel(look.mood, look.gender)}</span>
        </label>

        <div className="creator-quick">
          <button
            type="button"
            className="btn"
            onClick={() => {
              put(randomLook(look.gender));
              setSpin(null);
            }}
          >
            Losuj
          </button>
          <button
            type="button"
            className="btn"
            disabled={!history.length}
            onClick={() => {
              setLook(history[history.length - 1]!);
              setHistory((h) => h.slice(0, -1));
              setChanges((c) => c + 1);
            }}
          >
            Cofnij
          </button>
        </div>
      </div>

      <div className="creator-fields">
        <div className="creator-tabs" role="tablist" aria-label="Wygląd">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className="creator-tab"
              onClick={() => setTab(t.id)}
            >
              <BudSprite look={look} height={34} crop={t.crop === 'whole' ? undefined : t.crop} />
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        <div className="creator-panel" role="tabpanel" key={tab}>
          {tab === 'zestawy' && (
            <Field label="Gotowe zestawy">
              <div className="tiles tiles-4">
                {SETS.map((s) => (
                  <Tile
                    key={s.id}
                    id={s.id}
                    label={s.label}
                    selected={false}
                    look={forGender({ ...look, ...s.look }, look.gender)}
                    onPick={() => put(forGender({ ...look, ...s.look }, look.gender))}
                  />
                ))}
              </div>
            </Field>
          )}

          {tab === 'postac' && (
            <>
              <Field label="Kim jest">
                <div className="chips chips-2">
                  {GENDERS.map((g) => (
                    <button
                      key={g}
                      type="button"
                      className="chip"
                      aria-pressed={look.gender === g}
                      onClick={() => put(forGender(look, g))}
                    >
                      {GENDER_LABELS[g]}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Nastrój">
                <div className="tiles tiles-6">
                  {MOODS.map((m) => (
                    <Tile
                      key={m}
                      id={m}
                      label={moodLabel(m, look.gender)}
                      selected={look.mood === m}
                      look={{ ...look, mood: m }}
                      crop="face"
                      onPick={(mood) => update({ mood })}
                    />
                  ))}
                </div>
              </Field>
              <Field label="Karnacja">
                <Swatches
                  colors={SKINS}
                  value={look.skin}
                  onChange={(skin) => update({ skin })}
                  label="Karnacja"
                />
              </Field>
            </>
          )}

          {tab === 'wlosy' && (
            <>
              <Field label="Kolor włosów">
                <Swatches
                  colors={HAIR_COLORS}
                  value={look.hairColor}
                  onChange={(hairColor) => update({ hairColor })}
                  label="Kolor włosów"
                />
              </Field>
              <Field label="Fryzura">
                <div className="tiles tiles-5">
                  {HAIR_BY_GENDER[look.gender].map((h) => (
                    <Tile
                      key={h}
                      id={h}
                      label={HAIR_LABELS[h]}
                      selected={look.hair === h}
                      look={{ ...look, hair: h }}
                      crop="head"
                      onPick={(hair) => update({ hair })}
                    />
                  ))}
                </div>
              </Field>
            </>
          )}

          {tab === 'twarz' && (
            <>
              <Field label="Kolor oczu">
                <Swatches
                  colors={EYE_COLORS}
                  value={look.eyes ?? 0}
                  onChange={(eyes) => update({ eyes })}
                  label="Kolor oczu"
                />
              </Field>
              <Field label="Cecha">
                <div className="tiles tiles-4">
                  {FACE_MARKS_BY_GENDER[look.gender].map((m) => (
                    <Tile
                      key={m}
                      id={m}
                      label={FACE_MARK_LABELS[m]}
                      selected={(look.mark ?? 'brak') === m}
                      look={{ ...look, mark: m }}
                      crop="face"
                      onPick={(mark) => update({ mark })}
                    />
                  ))}
                </div>
              </Field>
              <Field label="Okulary">
                <div className="tiles tiles-5">
                  {GLASSES.map((g) => (
                    <Tile
                      key={g}
                      id={g}
                      label={GLASSES_LABELS[g]}
                      selected={(look.glasses ?? 'brak') === g}
                      look={{ ...look, glasses: g }}
                      crop="face"
                      onPick={(glasses) => update({ glasses })}
                    />
                  ))}
                </div>
              </Field>
            </>
          )}

          {tab === 'gora' && (
            <>
              <Field label="Kolor">
                <Swatches
                  colors={OUTFIT_COLORS}
                  value={look.outfitColor}
                  onChange={(outfitColor) => update({ outfitColor })}
                  label="Kolor góry"
                />
              </Field>
              <Field label="Ubranie">
                <div className="tiles tiles-4">
                  {OUTFITS_BY_GENDER[look.gender].map((o) => (
                    <Tile
                      key={o}
                      id={o}
                      label={OUTFIT_LABELS[o]}
                      selected={look.outfit === o}
                      look={{ ...look, outfit: o, accessory: 'brak' }}
                      crop="torso"
                      onPick={(outfit) => update({ outfit })}
                    />
                  ))}
                </div>
              </Field>
              <Field label="Nadruk">
                <div className="tiles tiles-4">
                  {PRINTS.map((pr) => (
                    <Tile
                      key={pr}
                      id={pr}
                      label={PRINT_LABELS[pr]}
                      selected={(look.print ?? 'gladka') === pr}
                      look={{ ...look, print: pr, accessory: 'brak' }}
                      crop="torso"
                      onPick={(print) => update({ print })}
                    />
                  ))}
                </div>
              </Field>
            </>
          )}

          {tab === 'dol' && (
            <>
              <Field label={look.outfit === 'ogrodniczki' ? 'Kolor ogrodniczek' : 'Kolor'}>
                <Swatches
                  colors={PANTS_COLORS}
                  value={look.pantsColor}
                  onChange={(pantsColor) => update({ pantsColor })}
                  label="Kolor nóg"
                />
              </Field>
              <Field label="Nogi">
                <div className="tiles tiles-4">
                  {PANTS_BY_GENDER[look.gender].map((p) => (
                    <Tile
                      key={p}
                      id={p}
                      label={PANTS_LABELS[p]}
                      selected={look.pants === p}
                      look={{ ...look, pants: p }}
                      crop="legs"
                      onPick={(pants) => update({ pants })}
                    />
                  ))}
                </div>
              </Field>
            </>
          )}

          {tab === 'buty' && (
            <>
              <Field label="Kolor">
                <Swatches
                  colors={SHOES_COLORS}
                  value={look.shoesColor ?? 0}
                  onChange={(shoesColor) => update({ shoesColor })}
                  label="Kolor butów"
                />
              </Field>
              <Field label="Buty">
                <div className="tiles tiles-4">
                  {SHOES_BY_GENDER[look.gender].map((sh) => (
                    <Tile
                      key={sh}
                      id={sh}
                      label={SHOES_LABELS[sh]}
                      selected={look.shoes === sh}
                      look={{ ...look, shoes: sh }}
                      crop="feet"
                      onPick={(shoes) => update({ shoes })}
                    />
                  ))}
                </div>
              </Field>
            </>
          )}

          {tab === 'dodatki' && (
            <>
              <Field label="Kolor dodatków, wykończeń i czapki">
                <Swatches
                  colors={OUTFIT_COLORS}
                  value={accent}
                  onChange={(a) => update({ accent: a })}
                  label="Kolor dodatków"
                  auto="Dobrany do ubrania"
                />
              </Field>
              <Field label="Dodatek">
                <div className="tiles tiles-6">
                  {ACCESSORIES.map((a) => (
                    <Tile
                      key={a}
                      id={a}
                      label={ACCESSORY_LABELS[a]}
                      selected={(look.accessory ?? 'brak') === a}
                      look={{ ...look, accessory: a }}
                      crop="torso"
                      onPick={(accessory) => update({ accessory })}
                    />
                  ))}
                </div>
              </Field>
            </>
          )}
        </div>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <button className="btn btn-primary btn-big" disabled={pending}>
          {pending ? 'Tworzę…' : 'Stwórz Buda'}
        </button>
      </div>
    </form>
  );
}
