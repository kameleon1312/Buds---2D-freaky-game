const KEY = 'buds:player';

export type StoredPlayer = { slug: string; token: string };

/** The guest credential for this browser. Best-effort: storage may be unavailable. */
export function getPlayer(): StoredPlayer | null {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (raw && typeof raw === 'object' && 'slug' in raw && 'token' in raw) {
      const { slug, token } = raw as Record<string, unknown>;
      if (typeof slug === 'string' && typeof token === 'string') return { slug, token };
    }
  } catch {
    // ignore
  }
  return null;
}

export function savePlayer(player: StoredPlayer): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(player));
  } catch {
    // private mode — the bud still exists, but this browser won't remember it
  }
}
