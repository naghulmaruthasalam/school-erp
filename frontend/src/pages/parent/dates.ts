/** date helpers shared across the parent portal pages (backend expects plain YYYY-MM-DD strings). */

export function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function todayIso(): string {
  return toIsoDate(new Date());
}

/** ISO date `daysAgo` days before today. */
export function daysAgoIso(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return toIsoDate(d);
}

export function formatDisplayDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
