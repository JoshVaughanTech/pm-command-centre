export function formatTimeAgo(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  const hours = diff / (1000 * 60 * 60);
  if (hours < 1) return 'just now';
  if (hours < 24) return `${Math.floor(hours)}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function computeComms(lastTouch: Date | string): number {
  const d = typeof lastTouch === 'string' ? new Date(lastTouch) : lastTouch;
  const days = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24);
  if (days < 1) return 95;
  if (days < 2) return 85;
  if (days < 3) return 70;
  if (days < 5) return 55;
  if (days < 7) return 35;
  return Math.max(10, 30 - Math.floor(days - 7) * 3);
}

export function computePortfolio(
  projects: Array<{ health: number; comms: number }>,
  risksCount: number,
  risksHighCount: number
) {
  const active = projects.length;
  const health = active > 0 ? Math.round(projects.reduce((s, p) => s + p.health, 0) / active) : 0;
  const updatesDue = projects.filter((p) => p.comms < 50).length;
  return {
    health,
    active,
    risksOpen: risksCount,
    risksHigh: risksHighCount,
    updatesDue,
    hoursSaved: 0,
  };
}

export function getDayName(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'long' });
}

export function getDateDisplay(date: Date): { day: string; month: string; year: string } {
  return {
    day: date.getDate().toString(),
    month: date.toLocaleDateString('en-US', { month: 'short' }),
    year: date.getFullYear().toString(),
  };
}
