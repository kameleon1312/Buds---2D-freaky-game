'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  BUD_NAME_MAX,
  GENDERS,
  GENDER_LABELS,
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
  SHOES_BY_GENDER,
  SHOES_COLORS,
  SHOES_LABELS,
  SKINS,
  budNameSchema,
  moodLabel,
  randomLook,
  type BudLook,
} from '@buds/shared';
import { createBud } from '@/lib/api';
import { accessToken } from '@/lib/supabase';
import { savePlayer } from '@/lib/player';
import { BudPreview } from './BudPreview';
import { BudSprite } from './BudSprite';

function Swatches({
  colors,
  value,
  onChange,
  label,
}: {
  colors: readonly string[];
  value: number;
  onChange: (i: number) => void;
  label: string;
}) {
  return (
    <div className="swatches" role="radiogroup" aria-label={label}>
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

export function Creator({ initialLook }: { initialLook: BudLook }) {
  const router = useRouter();
  const [look, setLook] = useState<BudLook>(initialLook);
  const [name, setName] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (patch: Partial<BudLook>) => setLook((l) => ({ ...l, ...patch }));
  const nameCheck = budNameSchema.safeParse(name);

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
    <form className="creator card" onSubmit={onSubmit} noValidate>
      <div className="creator-preview">
        <div className="stage">
          <BudPreview look={look} name={name || 'Twój Bud'} />
          <div className="stage-floor" aria-hidden />
        </div>
        <div className="creator-reveal">
          <p className="creator-name">{nameCheck.success ? nameCheck.data : 'Twój Bud'}</p>
          <p className="muted">
            {moodLabel(look.mood, look.gender)} · {moodBlurb(look.mood, look.gender)}
          </p>
        </div>
        <button type="button" className="btn" onClick={() => setLook(randomLook())}>
          Losuj wygląd
        </button>
      </div>

      <div className="creator-fields">
        <label className="field">
          <span className="field-label">Imię</span>
          <input
            className="input"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            maxLength={BUD_NAME_MAX}
            placeholder="np. Zuzia"
            autoComplete="nickname"
          />
        </label>

        <Field label="Kim jest">
          <div className="chips chips-2">
            {GENDERS.map((g) => (
              <button
                key={g}
                type="button"
                className="chip"
                aria-pressed={look.gender === g}
                onClick={() => {
                  // keep each part if it's in that gender's catalog, otherwise take its first pick
                  const keep = <T,>(list: readonly T[], v: T) => (list.includes(v) ? v : list[0]!);
                  update({
                    gender: g,
                    hair: keep(HAIR_BY_GENDER[g], look.hair),
                    outfit: keep(OUTFITS_BY_GENDER[g], look.outfit),
                    pants: keep(PANTS_BY_GENDER[g], look.pants),
                    shoes: keep(SHOES_BY_GENDER[g], look.shoes),
                  });
                }}
              >
                {GENDER_LABELS[g]}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Nastrój">
          <div className="chips chips-3">
            {MOODS.map((m) => (
              <button
                key={m}
                type="button"
                className="chip chip-face"
                aria-pressed={look.mood === m}
                onClick={() => update({ mood: m })}
              >
                <BudSprite look={{ ...look, mood: m }} height={40} crop="head" />
                <span>{moodLabel(m, look.gender)}</span>
              </button>
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

        <Field label="Fryzura">
          <div className="chips chips-5">
            {HAIR_BY_GENDER[look.gender].map((h) => (
              <button
                key={h}
                type="button"
                className="chip chip-face"
                aria-pressed={look.hair === h}
                onClick={() => update({ hair: h })}
              >
                <BudSprite look={{ ...look, hair: h }} height={40} crop="head" />
                <span>{HAIR_LABELS[h]}</span>
              </button>
            ))}
          </div>
          <Swatches
            colors={HAIR_COLORS}
            value={look.hairColor}
            onChange={(hairColor) => update({ hairColor })}
            label="Kolor włosów"
          />
        </Field>

        <Field label="Góra">
          <div className="chips chips-3">
            {OUTFITS_BY_GENDER[look.gender].map((o) => (
              <button
                key={o}
                type="button"
                className="chip"
                aria-pressed={look.outfit === o}
                onClick={() => update({ outfit: o })}
              >
                {OUTFIT_LABELS[o]}
              </button>
            ))}
          </div>
          <Swatches
            colors={OUTFIT_COLORS}
            value={look.outfitColor}
            onChange={(outfitColor) => update({ outfitColor })}
            label="Kolor góry"
          />
        </Field>

        <Field label="Nogi">
          <div className="chips chips-3">
            {PANTS_BY_GENDER[look.gender].map((p) => (
              <button
                key={p}
                type="button"
                className="chip"
                aria-pressed={look.pants === p}
                onClick={() => update({ pants: p })}
              >
                {PANTS_LABELS[p]}
              </button>
            ))}
          </div>
          <Swatches
            colors={PANTS_COLORS}
            value={look.pantsColor}
            onChange={(pantsColor) => update({ pantsColor })}
            label={look.outfit === 'ogrodniczki' ? 'Kolor ogrodniczek' : 'Kolor nóg'}
          />
        </Field>

        <Field label="Buty">
          <div className="chips chips-3">
            {SHOES_BY_GENDER[look.gender].map((sh) => (
              <button
                key={sh}
                type="button"
                className="chip"
                aria-pressed={look.shoes === sh}
                onClick={() => update({ shoes: sh })}
              >
                {SHOES_LABELS[sh]}
              </button>
            ))}
          </div>
          <Swatches
            colors={SHOES_COLORS}
            value={look.shoesColor}
            onChange={(shoesColor) => update({ shoesColor })}
            label="Kolor butów"
          />
        </Field>

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
