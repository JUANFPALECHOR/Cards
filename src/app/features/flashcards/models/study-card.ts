/** Tarjeta de estudio: una palabra lista para mostrarse en flashcards (práctica o Repasar). */
export interface StudyCard {
  /** id de la palabra (vocabulary_items.id). */
  readonly id: string;
  readonly term: string;
  readonly translation: string;
  readonly example: string | null;
  /** Pronunciación aproximada del término en inglés (opcional). */
  readonly pronunciation: string | null;
  /** Conjunto de origen; se muestra en Repasar, donde se mezclan conjuntos. */
  readonly setName: string | null;
}
