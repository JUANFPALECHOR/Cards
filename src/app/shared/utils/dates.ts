/** Medianoche local del día de `date`. */
export function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Suma días de calendario respetando cambios de horario (opera en hora local). */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/** Clave de día local "AAAA-MM-DD". */
export function toLocalDateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Zona horaria IANA del navegador (p. ej. "America/Bogota"). */
export function currentTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

const dateFormatter = new Intl.DateTimeFormat('es', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});
const dayFormatter = new Intl.DateTimeFormat('es', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

/** "29 oct 2026". */
export function formatDate(value: string | Date): string {
  return dateFormatter.format(typeof value === 'string' ? new Date(value) : value);
}

/** "hoy", "mañana" o "jueves, 5 de noviembre". */
export function formatDueDay(value: Date, now: Date = new Date()): string {
  const diff = Math.round(
    (startOfLocalDay(value).getTime() - startOfLocalDay(now).getTime()) / 86_400_000,
  );
  if (diff <= 0) return 'hoy';
  if (diff === 1) return 'mañana';
  return dayFormatter.format(value);
}
