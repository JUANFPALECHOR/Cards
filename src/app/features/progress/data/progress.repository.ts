import { Injectable, inject } from '@angular/core';
import { SessionService } from '../../../core/session/session.service';
import { unwrap } from '../../../core/supabase/app-error';
import { SUPABASE } from '../../../core/supabase/supabase.client';
import { currentTimeZone } from '../../../shared/utils/dates';
import {
  LearningRepository,
  StateRow,
  one,
  stateFromRow,
} from '../../spaced-repetition/data/learning.repository';
import { LearningState } from '../../spaced-repetition/domain/learning-state';
import { ProgressSnapshot } from '../domain/progress-stats';

export interface WordProgress {
  readonly itemId: string;
  readonly term: string;
  readonly translation: string;
  readonly state: LearningState;
}

export interface ProgressData extends ProgressSnapshot {
  /** Palabras que más cuestan, de más a menos difícil. */
  readonly attention: readonly WordProgress[];
}

/** Umbral de dificultad a partir del cual una palabra «necesita atención» aunque no sea difícil. */
const ATTENTION_DIFFICULTY = 30;

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

  async getProgress(): Promise<ProgressData> {
    await this.session.ensure();
    const timeZone = currentTimeZone();

    const [overview, studyDays, attention] = await Promise.all([
      this.learning.getOverview(timeZone),
      this.supabase
        .rpc('get_study_days', { p_time_zone: timeZone })
        .then((response) => (unwrap(response) ?? []).map((row) => row.study_day)),
      this.supabase
        .from('review_states')
        .select('*, vocabulary_items(term, translation)')
        .or(`status.eq.difficult,difficulty.gte.${ATTENTION_DIFFICULTY}`)
        .order('difficulty', { ascending: false })
        .limit(5)
        .then((response) => toWords(unwrap(response))),
    ]);

    return { overview, studyDays, attention };
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
