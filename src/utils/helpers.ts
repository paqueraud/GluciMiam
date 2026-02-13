export function v4ID(): string {
  return crypto.randomUUID?.() ?? Math.random().toString(36).substring(2) + Date.now().toString(36);
}

export function formatTime(date: Date): string {
  return new Date(date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatDateTime(date: Date): string {
  return `${formatDate(date)} ${formatTime(date)}`;
}

export function getCurrentTimePeriodIndex(periods: { period: { startHour: number; endHour: number } }[]): number {
  const hour = new Date().getHours();
  const idx = periods.findIndex((p) => {
    const s = p.period.startHour;
    const e = p.period.endHour;
    if (s <= e) return hour >= s && hour <= e;
    return hour >= s || hour <= e; // overnight period
  });
  return idx >= 0 ? idx : 0;
}
