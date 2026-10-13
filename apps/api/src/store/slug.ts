import { randomBytes } from 'node:crypto';

const ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789'; // no look-alikes (l/1, o/0)

/** "Łucja Nowak" -> "lucja-nowak-k3f9" */
export function makeSlug(ownerName: string): string {
  const base =
    ownerName
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .replace(/ł/gi, 'l')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 20)
      .replace(/-+$/, '') || 'bud';
  const suffix = [...randomBytes(4)].map((b) => ALPHABET[b % ALPHABET.length]).join('');
  return `${base}-${suffix}`;
}

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** 6 characters, no look-alikes — easy to read off a screen and type on a phone. */
export function makePairCode(): string {
  return [...randomBytes(6)].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}
