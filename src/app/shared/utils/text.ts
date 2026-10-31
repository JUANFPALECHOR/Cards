const ENYE_LOWER = '';
const ENYE_UPPER = '';

/**
 * Elimina tildes y diéresis. Con `keepEnye` la ñ se conserva: "niño" y "nino" son palabras distintas.
 */
export function stripAccents(text: string, options: { keepEnye?: boolean } = {}): string {
  let value = text.normalize('NFC');
  if (options.keepEnye) {
    value = value.replace(/ñ/g, ENYE_LOWER).replace(/Ñ/g, ENYE_UPPER);
  }
  value = value.normalize('NFD').replace(/\p{M}/gu, '').normalize('NFC');
  if (options.keepEnye) {
    value = value
      .replace(new RegExp(ENYE_LOWER, 'g'), 'ñ')
      .replace(new RegExp(ENYE_UPPER, 'g'), 'Ñ');
  }
  return value;
}

/** Clave de búsqueda tolerante: minúsculas, sin tildes y con espacios simples. */
export function toSearchKey(text: string): string {
  return stripAccents(text).toLocaleLowerCase('es').replace(/\s+/g, ' ').trim();
}

/** ¿Algún campo contiene la consulta? Una consulta vacía coincide con todo. */
export function matchesSearch(
  query: string,
  ...fields: ReadonlyArray<string | null | undefined>
): boolean {
  const key = toSearchKey(query);
  if (!key) return true;
  return fields.some((field) => !!field && toSearchKey(field).includes(key));
}

/** Recorta y convierte la cadena vacía en null (campos opcionales). */
export function toOptionalText(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

/** "1 palabra" / "3 palabras". */
export function pluralize(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
