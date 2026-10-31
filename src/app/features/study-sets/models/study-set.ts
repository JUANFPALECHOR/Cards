export interface StudySet {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly wordCount: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface StudySetInput {
  readonly name: string;
  readonly description: string | null;
}

export const STUDY_SET_NAME_MAX = 100;
export const STUDY_SET_DESCRIPTION_MAX = 500;
