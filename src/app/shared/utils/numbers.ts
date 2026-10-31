/** Porcentaje entero (0–100). Devuelve 0 si no hay total. */
export function toPercent(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}
