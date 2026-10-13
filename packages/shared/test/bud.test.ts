import { describe, expect, it } from 'vitest';
import {
  FACINGS,
  GENDERS,
  HAIR_STYLES,
  MOODS,
  OUTFITS,
  PANTS,
  SHOES,
  VIEW_H,
  VIEW_W,
  budFrameMarkup,
  budLookSchema,
  budPalette,
  budSheetSvg,
  budSvg,
  levelFromXp,
  moodBlurb,
  moodLabel,
  randomLook,
  type BudLook,
  type WalkFrame,
} from '../src';

const base: BudLook = {
  gender: 'on',
  mood: 'radosny',
  skin: 0,
  hair: 'krotkie',
  hairColor: 0,
  outfit: 'bluza',
  outfitColor: 0,
  pants: 'jeansy',
  pantsColor: 0,
  shoes: 'trampki',
  shoesColor: 0,
};

function everyCombination(): BudLook[] {
  return GENDERS.flatMap((gender) =>
    MOODS.flatMap((mood) =>
      HAIR_STYLES.flatMap((hair) =>
        OUTFITS.map((outfit, i) => ({
          ...base,
          gender,
          mood,
          hair,
          outfit,
          pants: PANTS[i % PANTS.length]!,
          shoes: SHOES[(i + HAIR_STYLES.indexOf(hair)) % SHOES.length]!,
        })),
      ),
    ),
  );
}

/** All numeric coordinates appearing in the markup. */
function numbers(markup: string): number[] {
  return [...markup.matchAll(/\s(?:x|y|cx|cy|d|width|height|r|rx|ry)="([^"]+)"/g)].flatMap((m) =>
    (m[1] ?? '').match(/-?\d+(\.\d+)?/g)!.map(Number),
  );
}

describe('budFrameMarkup', () => {
  // every style of every part, in every facing and step: thousands of frames
  it('produces well-formed markup for every option, facing and step', { timeout: 60_000 }, () => {
    for (const look of everyCombination()) {
      for (const facing of FACINGS) {
        for (const frame of [0, 1, 2] as WalkFrame[]) {
          const m = budFrameMarkup(look, facing, frame);
          expect(m, `${look.hair}/${look.outfit}/${facing}`).not.toMatch(/NaN|undefined/);
          // container tags are balanced and every clip-path reference has a definition
          for (const tag of ['g', 'clipPath']) {
            expect(m.split(`<${tag} `).length + m.split(`<${tag}>`).length - 1).toBe(
              m.split(`</${tag}>`).length,
            );
          }
          for (const [, id] of m.matchAll(/url\(#([^)]+)\)/g)) expect(m).toContain(`id="${id}"`);
          expect(m).not.toContain('@@');
        }
      }
    }
  });

  it('stays inside the frame so nothing is clipped', () => {
    for (const look of everyCombination()) {
      for (const facing of FACINGS) {
        const ns = numbers(budFrameMarkup(look, facing, 1));
        // relative arc deltas are negative: the largest circle (afro, r=34) has diameter 68
        expect(Math.min(...ns), `${look.hair}/${look.outfit}/${facing}`).toBeGreaterThanOrEqual(
          -68,
        );
        expect(Math.max(...ns), `${look.hair}/${look.outfit}/${facing}`).toBeLessThanOrEqual(
          VIEW_H,
        );
      }
    }
  }, 30_000); // walks every combination

  it('shows the face (mood) from the front and side but not from behind', () => {
    for (const mood of MOODS.filter((m) => m !== 'radosny')) {
      const other = { ...base, mood };
      expect(budFrameMarkup(other, 'down')).not.toBe(budFrameMarkup(base, 'down'));
      expect(budFrameMarkup(other, 'side')).not.toBe(budFrameMarkup(base, 'side'));
      expect(budFrameMarkup(other, 'up')).toBe(budFrameMarkup(base, 'up'));
    }
  });

  it('animates the walk: step frames differ from standing', () => {
    for (const facing of FACINGS) {
      const stand = budFrameMarkup(base, facing, 0);
      expect(budFrameMarkup(base, facing, 1)).not.toBe(stand);
      expect(budFrameMarkup(base, facing, 2)).not.toBe(stand);
      expect(budFrameMarkup(base, facing, 1)).not.toBe(budFrameMarkup(base, facing, 2));
    }
  });

  it('every option changes the drawing', () => {
    const front = (look: BudLook) => budFrameMarkup(look, 'down');
    expect(new Set(HAIR_STYLES.map((hair) => front({ ...base, hair }))).size).toBe(
      HAIR_STYLES.length,
    );
    expect(new Set(MOODS.map((mood) => front({ ...base, mood }))).size).toBe(MOODS.length);
    expect(new Set(OUTFITS.map((outfit) => front({ ...base, outfit }))).size).toBe(OUTFITS.length);
    expect(front({ ...base, gender: 'ona' })).not.toBe(front(base));
    expect(front({ ...base, skin: 5 })).toContain(budPalette({ ...base, skin: 5 }).skin[0]);
  });
});

describe('budSvg / budSheetSvg', () => {
  it('wraps a frame with the right size and optional mirror', () => {
    const svg = budSvg(base, { facing: 'side', width: 80, flip: true });
    expect(svg).toMatch(/^<svg [^>]*width="80" height="120"/);
    expect(svg).toContain(`translate(${VIEW_W} 0) scale(-1 1)`);
  });

  it('lays out a 3×3 sheet', () => {
    const sheet = budSheetSvg(base, 128);
    expect(sheet).toMatch(/width="384" height="576"/);
    // one group per cell, scaled from the 160-unit frame to 128 px
    expect(sheet.match(/scale\(0\.8\)/g)).toHaveLength(9);
  });
});

describe('look', () => {
  it('randomLook always validates', () => {
    for (let i = 0; i < 200; i++) expect(budLookSchema.safeParse(randomLook()).success).toBe(true);
  });

  it('rejects out-of-range colours', () => {
    expect(budLookSchema.safeParse({ ...base, skin: 99 }).success).toBe(false);
    expect(budLookSchema.safeParse({ ...base, hair: 'dredy' }).success).toBe(false);
  });

  it('labels agree with gender', () => {
    expect(moodLabel('niesmialy', 'on')).toBe('Nieśmiały');
    expect(moodLabel('niesmialy', 'ona')).toBe('Nieśmiała');
    expect(moodBlurb('zadziorny', 'ona')).toBe('zawsze gotowa do akcji');
  });
});

describe('levelFromXp', () => {
  it.each([
    [0, 1],
    [99, 1],
    [100, 2],
    [400, 3],
    [8100, 10],
  ])('%i xp -> level %i', (xp, level) => {
    expect(levelFromXp(xp).level).toBe(level);
  });
});
