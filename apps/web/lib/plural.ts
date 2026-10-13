/** Polish plural forms: 1 karmienie, 2–4 karmienia, 5+ karmień (12–14 → karmień). */
export function plural(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one;
  const tens = n % 100;
  const units = n % 10;
  if (units >= 2 && units <= 4 && (tens < 12 || tens > 14)) return few;
  return many;
}
