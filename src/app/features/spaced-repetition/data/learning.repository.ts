import { Injectable, inject } from '@angular/core';
import { StudyDirection } from '../../../core/models/study-direction';
import { SessionService } from '../../../core/session/session.service';
import { unwrap } from '../../../core/supabase/app-error';
import { Database, Json } from '../../../core/supabase/database.types';
import { SUPABASE } from '../../../core/supabase/supabase.client';
import {
  AttemptGrade,
  AttemptKind,
  LearningState,
  LearningStatus,
  TrackedStatus,
} from '../domain/learning-state';
import { ReviewMode } from '../domain/review-queue';

export type PracticeSource = 'flashcard' | 'quiz';
/** srs = Repasar · practice = flashcards o cuestionario de un conjunto. */
export type PracticeMode = 'srs' | 'practice';
/** recorded · duplicate (reenvío ya guardado) · conflict (otra pestaña escribió antes). */
export type RecordResult = 'recorded' | 'duplicate' | 'conflict';

export type StateRow = Database['public']['Tables']['review_states']['Row'];

export interface AttemptRecord {
  readonly attemptId: string;
  readonly itemId: string;
  readonly grade: AttemptGrade;
  readonly kind: AttemptKind;
  readonly direction: StudyDirection;
  readonly source: PracticeSource;
  readonly mode: PracticeMode;
  /** Versión del estado sobre la que se calculó el nuevo (0 = palabra nueva). */
  readonly expectedVersion: number;
  readonly state: LearningState;
}

/** Resumen del aprendizaje del usuario. Cada palabra cuenta en un único estado. */
export interface LearningOverview {
  readonly counts: Readonly<Record<LearningStatus, number>>;
  /** Total contado aparte en la base de datos (comprobación de coherencia). */
  readonly totalItems: number;
  readonly dueNow: number;
  /** Pendientes hasta el final de hoy (incluye las de ahora). */
  readonly dueToday: number;
  readonly dueTomorrow: number;
  /** Pendientes en los próximos 7 días (incluye las de hoy). */
  readonly dueWeek: number;
  readonly nextDueAt: Date | null;
  readonly totalAnswers: number;
  /** Aciertos, incluidos los «Me costó». */
  readonly correctAnswers: number;
  readonly hardAnswers: number;
  /** Palabras que pasaron hoy a dominadas (y siguen dominadas o aprendidas). */
  readonly masteredToday: number;
  readonly learnedToday: number;
}

export interface QueueEntry {
  readonly itemId: string;
  readonly setId: string;
  readonly setName: string;
  readonly term: string;
  readonly translation: string;
  readonly example: string | null;
  readonly pronunciation: string | null;
  /** null = palabra nueva. */
  readonly state: LearningState | null;
}

/** Persistencia del aprendizaje: intentos, estado por palabra y colas de Repasar. */
@Injectable({ providedIn: 'root' })
export class LearningRepository {
  private readonly supabase = inject(SUPABASE);
  private readonly session = inject(SessionService);

  /** Guarda el intento y el nuevo estado en una sola transacción (idempotente por attemptId). */
  async recordAttempt(record: AttemptRecord): Promise<RecordResult> {
    await this.session.ensure();
    const result = unwrap(
      await this.supabase.rpc('record_learning_attempt', {
        p_attempt_id: record.attemptId,
        p_item_id: record.itemId,
        p_grade: record.grade,
        p_direction: record.direction,
        p_source: record.source,
        p_mode: record.mode,
        p_question_type: record.kind,
        p_expected_version: record.expectedVersion,
        p_state: stateToRow(record.state),
      }),
    );
    return result as RecordResult;
  }

  async getState(itemId: string): Promise<LearningState | null> {
    await this.session.ensure();
    const row = unwrap(
      await this.supabase.from('review_states').select('*').eq('item_id', itemId).maybeSingle(),
    );
    return row ? stateFromRow(row) : null;
  }

  async getOverview(timeZone: string): Promise<LearningOverview> {
    await this.session.ensure();
    const rows = unwrap(
      await this.supabase.rpc('get_learning_overview', { p_time_zone: timeZone }),
    );
    const row = rows?.[0];
    if (!row) throw new Error('get_learning_overview no devolvió datos.');
    return {
      counts: {
        new: row.new_items,
        learning: row.learning_items,
        difficult: row.difficult_items,
        provisional: row.provisional_items,
        learned: row.learned_items,
      },
      totalItems: row.total_items,
      dueNow: row.due_now,
      dueToday: row.due_today,
      dueTomorrow: row.due_tomorrow,
      dueWeek: row.due_week,
      nextDueAt: row.next_due_at ? new Date(row.next_due_at) : null,
      totalAnswers: row.total_answers,
      correctAnswers: row.correct_answers,
      hardAnswers: row.hard_answers,
      masteredToday: row.mastered_today,
      learnedToday: row.learned_today,
    };
  }

  /** Candidatos del modo indicado (el orden final lo decide review-queue.ts). */
  async getQueue(mode: ReviewMode, newLimit: number): Promise<QueueEntry[]> {
    await this.session.ensure();
    const rows =
      unwrap(await this.supabase.rpc('get_study_queue', { p_mode: mode, p_new_limit: newLimit })) ??
      [];
    return rows.map((row) => ({
      itemId: row.item_id,
      setId: row.set_id,
      setName: row.set_name,
      term: row.term,
      translation: row.translation,
      // Las columnas de la función pueden ser nulas aunque el tipo generado no lo indique.
      example: (row.example as string | null) ?? null,
      pronunciation: (row.pronunciation as string | null) ?? null,
      state: row.state ? stateFromRow(row.state as unknown as StateRow) : null,
    }));
  }
}

/** Fila de review_states (o su JSON) → estado de dominio. */
export function stateFromRow(row: StateRow): LearningState {
  return {
    status: row.status as TrackedStatus,
    mastery: Number(row.mastery),
    difficulty: Number(row.difficulty),
    attempts: Number(row.attempts),
    successes: Number(row.successes),
    failures: Number(row.failures),
    hardCount: Number(row.hard_count),
    streak: Number(row.streak),
    streakPoints: Number(row.streak_points),
    streakStartedAt: toDate(row.streak_started_at),
    retentionPoints: Number(row.retention_points),
    recent: row.recent,
    lapses: Number(row.lapses),
    directions: {
      en_es: { attempts: Number(row.en_es_attempts), failures: Number(row.en_es_failures) },
      es_en: { attempts: Number(row.es_en_attempts), failures: Number(row.es_en_failures) },
    },
    intervalMinutes: Number(row.interval_minutes),
    dueAt: new Date(row.due_at),
    lastAttemptAt: new Date(row.last_reviewed_at),
    provisionalAt: toDate(row.provisional_at),
    learnedAt: toDate(row.learned_at),
    version: Number(row.version),
  };
}

/** Estado de dominio → JSON que espera record_learning_attempt. */
export function stateToRow(state: LearningState): Json {
  return {
    status: state.status,
    mastery: state.mastery,
    difficulty: state.difficulty,
    attempts: state.attempts,
    successes: state.successes,
    failures: state.failures,
    hard_count: state.hardCount,
    streak: state.streak,
    streak_points: state.streakPoints,
    streak_started_at: state.streakStartedAt?.toISOString() ?? null,
    retention_points: state.retentionPoints,
    recent: state.recent,
    lapses: state.lapses,
    en_es_attempts: state.directions.en_es.attempts,
    en_es_failures: state.directions.en_es.failures,
    es_en_attempts: state.directions.es_en.attempts,
    es_en_failures: state.directions.es_en.failures,
    interval_minutes: state.intervalMinutes,
    due_at: state.dueAt.toISOString(),
    last_reviewed_at: state.lastAttemptAt.toISOString(),
    provisional_at: state.provisionalAt?.toISOString() ?? null,
    learned_at: state.learnedAt?.toISOString() ?? null,
  };
}

function toDate(value: string | null): Date | null {
  return value ? new Date(value) : null;
}
