import { Injectable, inject } from '@angular/core';
import { SessionService } from '../../../core/session/session.service';
import { unwrap } from '../../../core/supabase/app-error';
import { SUPABASE } from '../../../core/supabase/supabase.client';
import { Database } from '../../../core/supabase/database.types';
import { StateRow, stateFromRow } from '../../spaced-repetition/data/learning.repository';
import { learningStatusOf } from '../../spaced-repetition/domain/learning-state';
import { VocabularyInput, VocabularyItem } from '../models/vocabulary-item';

type VocabularyRow = Database['public']['Tables']['vocabulary_items']['Row'] & {
  // PostgREST puede devolver la relación como arreglo o como objeto (1 a 1).
  review_states: StateRow[] | StateRow | null;
};

const COLUMNS =
  'id, set_id, owner_id, term, translation, example, notes, pronunciation_es, created_at, updated_at, review_states(*)';

@Injectable({ providedIn: 'root' })
export class VocabularyRepository {
  private readonly supabase = inject(SUPABASE);
  private readonly session = inject(SessionService);

  async listBySet(setId: string): Promise<VocabularyItem[]> {
    await this.session.ensure();
    const rows = unwrap(
      await this.supabase
        .from('vocabulary_items')
        .select(COLUMNS)
        .eq('set_id', setId)
        .order('created_at', { ascending: true }),
    );
    return (rows as VocabularyRow[]).map(toVocabularyItem);
  }

  async create(setId: string, input: VocabularyInput): Promise<VocabularyItem> {
    await this.session.ensure();
    const row = unwrap(
      await this.supabase
        .from('vocabulary_items')
        .insert({ set_id: setId, ...toColumns(input) })
        .select(COLUMNS)
        .single(),
    );
    return toVocabularyItem(row as VocabularyRow);
  }

  async update(id: string, input: VocabularyInput): Promise<VocabularyItem> {
    await this.session.ensure();
    const row = unwrap(
      await this.supabase
        .from('vocabulary_items')
        .update(toColumns(input))
        .eq('id', id)
        .select(COLUMNS)
        .single(),
    );
    return toVocabularyItem(row as VocabularyRow);
  }

  async remove(id: string): Promise<void> {
    await this.session.ensure();
    unwrap(await this.supabase.from('vocabulary_items').delete().eq('id', id));
  }
}

function toVocabularyItem(row: VocabularyRow): VocabularyItem {
  const stateRow = Array.isArray(row.review_states) ? row.review_states[0] : row.review_states;
  const learning = stateRow ? stateFromRow(stateRow) : null;
  return {
    id: row.id,
    setId: row.set_id,
    term: row.term,
    translation: row.translation,
    example: row.example,
    notes: row.notes,
    pronunciation: row.pronunciation_es,
    status: learningStatusOf(learning),
    learning,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toColumns(input: VocabularyInput) {
  return {
    term: input.term,
    translation: input.translation,
    example: input.example,
    notes: input.notes,
    pronunciation_es: input.pronunciation,
  };
}
