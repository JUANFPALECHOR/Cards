import { Injectable, inject } from '@angular/core';
import { StudySetsRepository } from '../../study-sets/data/study-sets.repository';
import { StudySet } from '../../study-sets/models/study-set';
import { VocabularyItem } from '../models/vocabulary-item';
import { VocabularyRepository } from './vocabulary.repository';

export interface StudyMaterial {
  readonly set: StudySet;
  readonly items: readonly VocabularyItem[];
}

/** Carga un conjunto con su vocabulario (flashcards y cuestionarios). */
@Injectable({ providedIn: 'root' })
export class StudyMaterialService {
  private readonly sets = inject(StudySetsRepository);
  private readonly vocabulary = inject(VocabularyRepository);

  async load(setId: string): Promise<StudyMaterial> {
    const [set, items] = await Promise.all([
      this.sets.get(setId),
      this.vocabulary.listBySet(setId),
    ]);
    return { set, items };
  }
}
