import { Injectable, inject } from '@angular/core';
import { StudyDirection } from '../../../core/models/study-direction';
import { SessionService } from '../../../core/session/session.service';
import { unwrap } from '../../../core/supabase/app-error';
import { SUPABASE } from '../../../core/supabase/supabase.client';
import { currentTimeZone, startOfLocalDay } from '../../../shared/utils/dates';
import {
  LearningRepository,
  PracticeSource,
  StateRow,
  stateFromRow,
} from '../../spaced-repetition/data/learning.repository';
import {
  AttemptGrade,
  AttemptKind,
  LearningState,
} from '../../spaced-repetition/domain/learning-state';
import { ProgressSnapshot } from '../domain/progress-stats';

export interface WordProgress {
  readonly itemId: string;
  readonly term: string;
  readonly translation: string;
  readonly state: LearningState;
}

export interface WeeklyPoint {
  /** Lunes de la semana, AAAA-MM-DD. */
  readonly weekStart: string;
  readonly answers: number;
  readonly correct: number;
  readonly mastered: number;
  readonly learned: number;
}

export interface RecentAttempt {
  readonly id: string;
  readonly term: string;
  readonly at: Date;
  readonly grade: AttemptGrade;
  readonly source: PracticeSource;
  /** null en respuestas antiguas de cuestionario (no se registraba el tipo). */
  readonly kind: AttemptKind | null;
  readonly direction: StudyDirection;
}

export interface ProgressData extends ProgressSnapshot {
  readonly weekly: readonly WeeklyPoint[];
  /** Palabras que más cuestan, de más a menos difícil. */
  readonly attention: readonly WordProgress[];
  readonly masteredToday: readonly WordProgress[];
  readonly recentlyLearned: readonly WordProgress[];
  readonly recentAttempts: readonly RecentAttempt[];
}

/** Umbral de dificultad a partir del cual una palabra «necesita atención» aunque no sea difícil. */
const ATTENTION_DIFFICULTY = 30;
const WEEKS = 8;

type StateWithWord = StateRow & {
  vocabulary_items:
    { term: string; translation: string } | { term: string; translation: string }[] | null;
};

/** Lee los datos de Progreso. Los conteos se calculan en la base de datos. */
@Injectable({ providedIn: 'root' })
export class ProgressRepository {
  private readonly supabase = inject(SUPABASE);
  private readonly session = inject(SessionService);
  private readonly learning = inject(LearningRepository);

  async getProgress(now: Date = new Date()): Promise<ProgressData> {
    await this.session.ensure();
    const timeZone = currentTimeZone();
    const todayStart = startOfLocalDay(now).toISOString();
    const withWord = '*, vocabulary_items(term, translation)';

    const [overview, studyDays, weekly, attention, masteredToday, recentlyLearned, recentAttempts] =
      await Promise.all([
        this.learning.getOverview(timeZone),
        this.supabase
          .rpc('get_study_days', { p_time_zone: timeZone })
          .then((response) => (unwrap(response) ?? []).map((row) => row.study_day)),
        this.supabase
          .rpc('get_weekly_progress', { p_time_zone: timeZone, p_weeks: WEEKS })
          .then((response) =>
            (unwrap(response) ?? []).map((row) => ({
              weekStart: row.week_start,
              answers: row.answers,
              correct: row.correct,
              mastered: row.mastered,
              learned: row.learned,
            })),
          ),
        this.supabase
          .from('review_states')
          .select(withWord)
          .or(`status.eq.difficult,difficulty.gte.${ATTENTION_DIFFICULTY}`)
          .order('difficulty', { ascending: false })
          .limit(5)
          .then((response) => toWords(unwrap(response))),
        this.supabase
          .from('review_states')
          .select(withWord)
          .in('status', ['provisional', 'learned'])
          .gte('provisional_at', todayStart)
          .order('provisional_at', { ascending: false })
          .limit(12)
          .then((response) => toWords(unwrap(response))),
        this.supabase
          .from('review_states')
          .select(withWord)
          .eq('status', 'learned')
          .order('learned_at', { ascending: false })
          .limit(6)
          .then((response) => toWords(unwrap(response))),
        this.supabase
          .from('review_events')
          .select(
            'id, reviewed_at, knew, grade, source, question_type, direction, vocabulary_items(term)',
          )
          .order('reviewed_at', { ascending: false })
          .limit(8)
          .then((response) =>
            (unwrap(response) ?? []).map((row): RecentAttempt => ({
              id: row.id,
              term: one(row.vocabulary_items)?.term ?? '—',
              at: new Date(row.reviewed_at),
              // Respuestas anteriores a la evaluación en tres niveles: se deduce de «knew».
              grade: (row.grade as AttemptGrade | null) ?? (row.knew ? 'good' : 'again'),
              source: row.source as PracticeSource,
              kind:
                (row.question_type as AttemptKind | null) ??
                (row.source === 'flashcard' ? 'self_assessment' : null),
              direction: row.direction as StudyDirection,
            })),
          ),
      ]);

    return {
      overview,
      studyDays,
      weekly,
      attention,
      masteredToday,
      recentlyLearned,
      recentAttempts,
    };
  }
}

function toWords(rows: readonly unknown[] | null): WordProgress[] {
  return ((rows ?? []) as StateWithWord[]).map((row) => {
    const word = one(row.vocabulary_items);
    return {
      itemId: row.item_id,
      term: word?.term ?? '—',
      translation: word?.translation ?? '',
      state: stateFromRow(row),
    };
  });
}

/** PostgREST puede devolver una relación como objeto o como arreglo de uno. */
function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}
