import { Injectable, inject } from '@angular/core';
import { SessionService } from '../../../core/session/session.service';
import { AppError, unwrap } from '../../../core/supabase/app-error';
import { SUPABASE } from '../../../core/supabase/supabase.client';
import { Database } from '../../../core/supabase/database.types';
import { StudySet, StudySetInput } from '../models/study-set';

type StudySetRow = Database['public']['Tables']['study_sets']['Row'] & {
  vocabulary_items: { count: number }[];
};

const COLUMNS = 'id, name, description, created_at, updated_at, vocabulary_items(count)';

/** Acceso a datos de conjuntos. Única capa que conoce las tablas de Supabase para esta funcionalidad. */
@Injectable({ providedIn: 'root' })
export class StudySetsRepository {
  private readonly supabase = inject(SUPABASE);
  private readonly session = inject(SessionService);

  async list(): Promise<StudySet[]> {
    await this.session.ensure();
    const rows = unwrap(
      await this.supabase
        .from('study_sets')
        .select(COLUMNS)
        .order('updated_at', { ascending: false }),
    );
    return (rows as StudySetRow[]).map(toStudySet);
  }

  async get(id: string): Promise<StudySet> {
    await this.session.ensure();
    const row = unwrap(
      await this.supabase.from('study_sets').select(COLUMNS).eq('id', id).maybeSingle(),
    );
    if (!row) throw new AppError('not-found');
    return toStudySet(row as StudySetRow);
  }

  async create(input: StudySetInput): Promise<StudySet> {
    await this.session.ensure();
    const row = unwrap(
      await this.supabase
        .from('study_sets')
        .insert({ name: input.name, description: input.description })
        .select(COLUMNS)
        .single(),
    );
    return toStudySet(row as StudySetRow);
  }

  async update(id: string, input: StudySetInput): Promise<StudySet> {
    await this.session.ensure();
    const row = unwrap(
      await this.supabase
        .from('study_sets')
        .update({ name: input.name, description: input.description })
        .eq('id', id)
        .select(COLUMNS)
        .single(),
    );
    return toStudySet(row as StudySetRow);
  }

  async remove(id: string): Promise<void> {
    await this.session.ensure();
    unwrap(await this.supabase.from('study_sets').delete().eq('id', id));
  }
}

function toStudySet(row: StudySetRow): StudySet {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    wordCount: row.vocabulary_items[0]?.count ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
