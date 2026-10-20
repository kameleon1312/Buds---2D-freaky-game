/**
 * Chat on the map (live.ts `chat`): players type their own words, the server cleans them before anyone sees them.
 * Swear words are starred out (also written with digits, dots or spaced letters), and links, e-mail addresses and
 * phone numbers never get through (nobody is lured off the game or asked for a number). Messages are short and
 * rate limited; each player can also mute anyone on their own device.
 */

/** Longest message, in characters. */
export const CHAT_MAX_LENGTH = 80;
/** At most this many messages in CHAT_WINDOW_SECONDS, and never two closer than CHAT_GAP_SECONDS. */
export const CHAT_BURST = 4;
export const CHAT_WINDOW_SECONDS = 8;
export const CHAT_GAP_SECONDS = 0.7;
/** The same words again within this many seconds count as spam. */
export const CHAT_REPEAT_SECONDS = 15;

const HIDDEN = '***';

/**
 * Roots of words that are starred out wherever they appear in a word (Polish inflects: one root covers every form).
 * Chosen so that no everyday word contains them.
 */
const ROOTS = [
  'kurw',
  'chuj',
  'huj',
  'pierdol',
  'pierdal',
  'pierdziel',
  'jeba',
  'jebi',
  'jebn',
  'jebal',
  'jebie',
  'pizd',
  'cipa',
  'cipy',
  'cipk',
  'dziwk',
  'kutas',
  'cwel',
  'skurw',
  'zjeb',
  'fuck',
  'shit',
  'bitch',
  'cunt',
  'nigga',
  'whore',
].map(squeeze);

/** Runs of one letter as one ("kuuurwa" → "kurwa"); roots are matched in the same form. */
function squeeze(word: string): string {
  return word.replace(/(.)\1+/gu, '$1');
}

/** Letters as players disguise them: digits and signs for letters, Polish letters without their marks. */
const LOOKALIKE: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '@': 'a',
  $: 's',
  '!': 'i',
  ą: 'a',
  ć: 'c',
  ę: 'e',
  ł: 'l',
  ń: 'n',
  ó: 'u', // "chój" is "chuj"
  ś: 's',
  ź: 'z',
  ż: 'z',
};

/** Signs players put between letters to slip past a filter ("k.u.r.w.a", "k_u_r_w_a"). */
const SEPARATORS = new Set(['.', '-', '_', '*', '+', ',', "'", '"', '`', '~', '|', '/', '\\']);

/** Stars out every swear root in `text` (same length, so the message keeps its shape). */
function starSwears(text: string): string {
  const out = [...text];
  // the letters only, each with where it stood; single letters split by spaces are joined too ("k u r w a")
  const letters: { c: string; at: number }[] = [];
  for (let i = 0; i < out.length; i++) {
    const raw = out[i]!.toLowerCase();
    if (SEPARATORS.has(raw)) continue;
    if (raw === ' ') {
      const prev = out[i - 1] ?? ' ';
      const next = out[i + 1] ?? ' ';
      const prevSingle = (out[i - 2] ?? ' ') === ' ' && prev !== ' ';
      const nextSingle = (out[i + 2] ?? ' ') === ' ' && next !== ' ';
      if (prevSingle && nextSingle) continue; // a gap inside spaced-out letters
      letters.push({ c: ' ', at: i });
      continue;
    }
    letters.push({ c: LOOKALIKE[raw] ?? raw, at: i });
  }
  // repeated letters squeezed ("kuuurwa"), remembering every position they covered
  const squeezed: { c: string; from: number; to: number }[] = [];
  for (const l of letters) {
    const last = squeezed[squeezed.length - 1];
    if (last && last.c === l.c && l.c !== ' ') last.to = l.at;
    else squeezed.push({ c: l.c, from: l.at, to: l.at });
  }
  const flat = squeezed.map((l) => l.c).join('');
  for (const root of ROOTS) {
    for (let i = flat.indexOf(root); i >= 0; i = flat.indexOf(root, i + 1)) {
      // the whole word the root sits in goes
      let a = i;
      let b = i + root.length - 1;
      while (a > 0 && flat[a - 1] !== ' ') a--;
      while (b < flat.length - 1 && flat[b + 1] !== ' ') b++;
      for (let k = squeezed[a]!.from; k <= squeezed[b]!.to; k++) if (out[k] !== ' ') out[k] = '*';
    }
  }
  return out.join('');
}

const LINK = /\b(?:https?:\/\/|www\.)\S*/giu;
const DOMAIN =
  /\b[\p{L}\d-]+(?:\.[\p{L}\d-]+)*\.(?:com|pl|net|org|io|gg|xyz|tv|ru|eu|info|app|link|ly|uk|de|biz|online|site|shop)\b\S*/giu;
const EMAIL = /\S+@\S+/gu;
/** Seven or more digits, maybe split by spaces, dashes or dots: a phone number (or a code someone shouldn't share). */
const DIGITS = /\+?\d(?:[\s.\-()]*\d){6,}/gu;
/** Invisible characters and controls that could hide words or break a line (code point ranges). */
const INVISIBLE: readonly [number, number][] = [
  [0x00, 0x1f],
  [0x7f, 0x9f],
  [0xad, 0xad], // soft hyphen
  [0x200b, 0x200f], // zero-width spaces and direction marks
  [0x2028, 0x202e], // line separators and direction overrides
  [0x2060, 0x206f],
  [0xfeff, 0xfeff],
];
const invisible = (c: string) => {
  const code = c.codePointAt(0)!;
  return INVISIBLE.some(([a, b]) => code >= a && code <= b);
};

/**
 * A message as the room will see it: trimmed, spaces collapsed, at most CHAT_MAX_LENGTH characters, no more than
 * three of one character in a row, swear words starred, links, e-mails and phone numbers hidden.
 * null when nothing is left to say.
 */
export function cleanChat(input: string): string | null {
  let text = [...(input ?? '').normalize('NFC')].map((c) => (invisible(c) ? ' ' : c)).join('');
  text = text.replace(/\s+/gu, ' ').trim();
  text = text.replace(/(.)\1{3,}/gu, '$1$1$1');
  text = [...text].slice(0, CHAT_MAX_LENGTH).join('');
  text = text
    .replace(LINK, HIDDEN)
    .replace(EMAIL, HIDDEN)
    .replace(DOMAIN, HIDDEN)
    .replace(DIGITS, HIDDEN);
  text = starSwears(text);
  text = text.replace(/\s+/gu, ' ').trim();
  if (!text || /^[*\s]*$/u.test(text)) return null;
  return text;
}

/** Whether a bud may send a message now, given when it sent its last ones (seconds) and what it said last. */
export function chatAllowed(
  sentAt: readonly number[],
  now: number,
  text: string,
  last?: { text: string; at: number },
): boolean {
  const recent = sentAt.filter((t) => now - t < CHAT_WINDOW_SECONDS);
  if (recent.length >= CHAT_BURST) return false;
  if (recent.length > 0 && now - recent[recent.length - 1]! < CHAT_GAP_SECONDS) return false;
  if (last && last.text.toLowerCase() === text.toLowerCase() && now - last.at < CHAT_REPEAT_SECONDS)
    return false;
  return true;
}
