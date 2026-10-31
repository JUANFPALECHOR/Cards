// Tipos generados desde el esquema de Supabase (proyecto Cards).
// Regenerar tras cada migración:
//   supabase gen types typescript --project-id bsdcswwsspidnhsfuxei > src/app/core/supabase/database.types.ts
// Nota: las columnas de funciones RPC aparecen como no nulas aunque puedan serlo
// (p. ej. get_study_queue.state en palabras nuevas); los repositorios lo tratan explícitamente.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.18';
  };
  public: {
    Tables: {
      pronunciation_audio: {
        Row: {
          cache_key: string;
          characters: number;
          completed_at: string | null;
          created_at: string;
          created_by: string | null;
          model_id: string;
          provider_cost: number | null;
          status: string;
          storage_path: string;
          text: string;
          voice_id: string;
        };
        Insert: {
          cache_key: string;
          characters: number;
          completed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          model_id: string;
          provider_cost?: number | null;
          status?: string;
          storage_path: string;
          text: string;
          voice_id: string;
        };
        Update: {
          cache_key?: string;
          characters?: number;
          completed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          model_id?: string;
          provider_cost?: number | null;
          status?: string;
          storage_path?: string;
          text?: string;
          voice_id?: string;
        };
        Relationships: [];
      };
      review_events: {
        Row: {
          client_attempt_id: string | null;
          direction: string;
          grade: string | null;
          id: string;
          item_id: string;
          knew: boolean;
          mode: string;
          owner_id: string;
          question_type: string | null;
          reviewed_at: string;
          source: string;
          status_after: string | null;
        };
        Insert: {
          client_attempt_id?: string | null;
          direction: string;
          grade?: string | null;
          id?: string;
          item_id: string;
          knew: boolean;
          mode: string;
          owner_id?: string;
          question_type?: string | null;
          reviewed_at?: string;
          source: string;
          status_after?: string | null;
        };
        Update: {
          client_attempt_id?: string | null;
          direction?: string;
          grade?: string | null;
          id?: string;
          item_id?: string;
          knew?: boolean;
          mode?: string;
          owner_id?: string;
          question_type?: string | null;
          reviewed_at?: string;
          source?: string;
          status_after?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'review_events_item_id_owner_id_fkey';
            columns: ['item_id', 'owner_id'];
            isOneToOne: false;
            referencedRelation: 'vocabulary_items';
            referencedColumns: ['id', 'owner_id'];
          },
        ];
      };
      review_states: {
        Row: {
          attempts: number;
          box: number;
          created_at: string;
          difficulty: number;
          due_at: string;
          en_es_attempts: number;
          en_es_failures: number;
          es_en_attempts: number;
          es_en_failures: number;
          failures: number;
          hard_count: number;
          interval_minutes: number;
          item_id: string;
          lapses: number;
          last_reviewed_at: string;
          learned_at: string | null;
          mastery: number;
          owner_id: string;
          provisional_at: string | null;
          recent: string;
          retention_points: number;
          status: string;
          streak: number;
          streak_points: number;
          streak_started_at: string | null;
          successes: number;
          updated_at: string;
          version: number;
        };
        Insert: {
          attempts?: number;
          box: number;
          created_at?: string;
          difficulty?: number;
          due_at: string;
          en_es_attempts?: number;
          en_es_failures?: number;
          es_en_attempts?: number;
          es_en_failures?: number;
          failures?: number;
          hard_count?: number;
          interval_minutes?: number;
          item_id: string;
          lapses?: number;
          last_reviewed_at: string;
          learned_at?: string | null;
          mastery?: number;
          owner_id?: string;
          provisional_at?: string | null;
          recent?: string;
          retention_points?: number;
          status?: string;
          streak?: number;
          streak_points?: number;
          streak_started_at?: string | null;
          successes?: number;
          updated_at?: string;
          version?: number;
        };
        Update: {
          attempts?: number;
          box?: number;
          created_at?: string;
          difficulty?: number;
          due_at?: string;
          en_es_attempts?: number;
          en_es_failures?: number;
          es_en_attempts?: number;
          es_en_failures?: number;
          failures?: number;
          hard_count?: number;
          interval_minutes?: number;
          item_id?: string;
          lapses?: number;
          last_reviewed_at?: string;
          learned_at?: string | null;
          mastery?: number;
          owner_id?: string;
          provisional_at?: string | null;
          recent?: string;
          retention_points?: number;
          status?: string;
          streak?: number;
          streak_points?: number;
          streak_started_at?: string | null;
          successes?: number;
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'review_states_item_id_owner_id_fkey';
            columns: ['item_id', 'owner_id'];
            isOneToOne: false;
            referencedRelation: 'vocabulary_items';
            referencedColumns: ['id', 'owner_id'];
          },
        ];
      };
      study_sets: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          name: string;
          owner_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          name: string;
          owner_id?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          name?: string;
          owner_id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      vocabulary_items: {
        Row: {
          created_at: string;
          example: string | null;
          id: string;
          notes: string | null;
          owner_id: string;
          pronunciation_es: string | null;
          set_id: string;
          term: string;
          translation: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          example?: string | null;
          id?: string;
          notes?: string | null;
          owner_id?: string;
          pronunciation_es?: string | null;
          set_id: string;
          term: string;
          translation: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          example?: string | null;
          id?: string;
          notes?: string | null;
          owner_id?: string;
          pronunciation_es?: string | null;
          set_id?: string;
          term?: string;
          translation?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'vocabulary_items_set_id_owner_id_fkey';
            columns: ['set_id', 'owner_id'];
            isOneToOne: false;
            referencedRelation: 'study_sets';
            referencedColumns: ['id', 'owner_id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      claim_pronunciation_audio: {
        Args: {
          p_cache_key: string;
          p_daily_limit: number;
          p_model_id: string;
          p_monthly_char_limit: number;
          p_storage_path: string;
          p_text: string;
          p_user_id: string;
          p_voice_id: string;
        };
        Returns: string;
      };
      get_learning_overview: {
        Args: { p_time_zone: string };
        Returns: {
          correct_answers: number;
          difficult_items: number;
          due_now: number;
          due_today: number;
          due_tomorrow: number;
          due_week: number;
          hard_answers: number;
          learned_items: number;
          learned_today: number;
          learning_items: number;
          mastered_today: number;
          new_items: number;
          next_due_at: string;
          provisional_items: number;
          total_answers: number;
          total_items: number;
        }[];
      };
      get_review_queue: {
        Args: { p_new_limit?: number };
        Returns: {
          box: number;
          due_at: string;
          example: string;
          item_id: string;
          set_id: string;
          set_name: string;
          term: string;
          translation: string;
        }[];
      };
      get_study_days: {
        Args: { p_time_zone: string };
        Returns: {
          study_day: string;
        }[];
      };
      get_study_queue: {
        Args: { p_mode: string; p_new_limit?: number };
        Returns: {
          example: string;
          item_id: string;
          pronunciation: string;
          set_id: string;
          set_name: string;
          state: Json;
          term: string;
          translation: string;
        }[];
      };
      get_weekly_progress: {
        Args: { p_time_zone: string; p_weeks?: number };
        Returns: {
          answers: number;
          correct: number;
          learned: number;
          mastered: number;
          week_start: string;
        }[];
      };
      record_learning_attempt: {
        Args: {
          p_attempt_id: string;
          p_direction: string;
          p_expected_version: number;
          p_grade: string;
          p_item_id: string;
          p_mode: string;
          p_question_type: string;
          p_source: string;
          p_state: Json;
        };
        Returns: string;
      };
      record_srs_review: {
        Args: {
          p_box: number;
          p_direction: string;
          p_due_at: string;
          p_item_id: string;
          p_knew: boolean;
        };
        Returns: undefined;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
