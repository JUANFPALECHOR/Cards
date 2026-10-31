/**
 * Parámetros del aprendizaje adaptativo. Todos los umbrales viven aquí: para ajustarlos basta con
 * cambiar estos valores (o proveer otra configuración con LEARNING_CONFIG), sin tocar componentes.
 * Cada parámetro está explicado en README → «Aprendizaje adaptativo».
 */
export interface LearningConfig {
  /** Dos intentos de la misma palabra con menos de estos minutos de diferencia: repetición inmediata. */
  readonly immediateWindowMinutes: number;
  /** Peso de un acierto según el tipo de pregunta (recordar sin pistas vale más que reconocer). */
  readonly kindWeight: Readonly<Record<'self_assessment' | 'multiple_choice' | 'written', number>>;
  /** Peso de «Me costó» frente a «La sabía». */
  readonly hardWeight: number;

  /** Dominio actual (0–100): fracción de lo que falta hasta 100 que suma un acierto de peso 1. */
  readonly masteryGain: number;
  /** Fracción del dominio que se conserva tras un fallo. */
  readonly masteryKeptOnFailure: number;

  /** Dominada provisionalmente: buen rendimiento reciente, aunque sea en un solo día. */
  readonly provisional: {
    readonly minMastery: number;
    /** Puntos de aciertos independientes seguidos (sin fallos entre medias). */
    readonly minStreakPoints: number;
    /** Tiempo mínimo entre el primer y el último acierto de esa racha. */
    readonly minSpanMinutes: number;
  };

  /** Aprendida: además del dominio, retención comprobada en días distintos. */
  readonly learned: {
    /** Un acierto cuenta como prueba de retención si pasaron al menos estas horas sin ver la palabra. */
    readonly retentionGapHours: number;
    /** Con al menos estos días sin verla, la prueba de retención vale el doble. */
    readonly strongRetentionDays: number;
    readonly minRetentionPoints: number;
    /** Días mínimos que debe abarcar la racha de aciertos. */
    readonly minSpanDays: number;
  };

  /** Difícil: puntuación de dificultad (0–100) con histéresis para no cambiar por un resultado aislado. */
  readonly difficult: {
    readonly enterScore: number;
    readonly exitScore: number;
    readonly minAttempts: number;
    readonly minFailures: number;
    /** Resultados recientes que se conservan para medir el rendimiento reciente. */
    readonly recentWindow: number;
    /** Peso de cada factor en la puntuación (suman 1). */
    readonly weights: {
      readonly recent: number;
      readonly lifetime: number;
      readonly lapses: number;
      readonly direction: number;
    };
    /** Cada acierto seguido reduce la puntuación en esta fracción (hasta `maxReliefStreak` aciertos). */
    readonly streakRelief: number;
    readonly maxReliefStreak: number;
  };

  /** Programación de repasos (SRS). */
  readonly schedule: {
    /** Tras un fallo, la palabra vuelve en estos minutos. */
    readonly failureMinutes: number;
    /** Pasos de aprendizaje en minutos según la racha de aciertos (1.º, 2.º, 3.º o más). */
    readonly learningStepsMinutes: readonly number[];
    /** Primer intervalo, en días, al dominar una palabra. */
    readonly firstReviewDays: number;
    /** Multiplicador del intervalo con «La sabía» y con «Me costó». */
    readonly goodFactor: number;
    readonly hardFactor: number;
    /** Un repaso antes de esta fracción del intervalo no lo amplía (solo lo mantiene). */
    readonly earlyReviewRatio: number;
    /** Intervalo máximo: una palabra aprendida nunca sale del sistema de repasos. */
    readonly maxIntervalDays: number;
  };
}

export const DEFAULT_LEARNING_CONFIG: LearningConfig = {
  immediateWindowMinutes: 10,
  kindWeight: { written: 1, self_assessment: 0.8, multiple_choice: 0.5 },
  hardWeight: 0.5,

  masteryGain: 0.35,
  masteryKeptOnFailure: 0.5,

  provisional: { minMastery: 70, minStreakPoints: 3, minSpanMinutes: 120 },

  learned: {
    retentionGapHours: 12,
    strongRetentionDays: 7,
    // Dos comprobaciones en días distintos (tres si son de selección múltiple).
    minRetentionPoints: 1.5,
    minSpanDays: 3,
  },

  difficult: {
    enterScore: 45,
    exitScore: 30,
    minAttempts: 3,
    minFailures: 2,
    recentWindow: 8,
    weights: { recent: 0.5, lifetime: 0.2, lapses: 0.15, direction: 0.15 },
    streakRelief: 0.15,
    maxReliefStreak: 4,
  },

  schedule: {
    failureMinutes: 10,
    learningStepsMinutes: [10, 60, 240],
    firstReviewDays: 1,
    goodFactor: 2.5,
    hardFactor: 1.2,
    earlyReviewRatio: 0.5,
    maxIntervalDays: 120,
  },
};

/** Palabras nuevas que se incorporan como máximo en cada sesión de Repaso inteligente. */
export const NEW_ITEMS_PER_REVIEW = 20;
/** Tarjetas como máximo por sesión de Repasar (las pendientes que no entren siguen pendientes). */
export const MAX_REVIEW_CARDS = 40;
/** Tarjetas como máximo en «Practicar mis dificultades». */
export const MAX_DIFFICULT_CARDS = 20;
