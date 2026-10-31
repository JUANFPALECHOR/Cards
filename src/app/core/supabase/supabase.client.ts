import { InjectionToken } from '@angular/core';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import { Database } from './database.types';

export type AppSupabaseClient = SupabaseClient<Database>;

/**
 * Cliente único de Supabase. Solo usa la clave publicable: la seguridad de los datos
 * depende de RLS (cada fila pertenece a auth.uid()). Nunca usar service_role en el frontend.
 */
export const SUPABASE = new InjectionToken<AppSupabaseClient>('SUPABASE', {
  providedIn: 'root',
  factory: () =>
    createClient<Database>(environment.supabaseUrl, environment.supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    }),
});
