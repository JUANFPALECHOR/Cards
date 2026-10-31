import { Injectable, inject } from '@angular/core';
import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js';
import { SessionService } from '../../../core/session/session.service';
import { AppError, AppErrorKind } from '../../../core/supabase/app-error';
import { SUPABASE } from '../../../core/supabase/supabase.client';

export interface AudioSource {
  readonly url: string;
  /** Instante (ms) en que caduca la URL firmada. */
  readonly expiresAt: number;
}

/** Códigos de error de la Edge Function `pronounce` y cómo se presentan al usuario. */
const ERROR_KINDS: Readonly<Record<string, AppErrorKind>> = {
  unauthorized: 'session',
  forbidden: 'session',
  'item-not-found': 'not-found',
  generating: 'audio-busy',
  'provider-busy': 'audio-busy',
  'daily-limit': 'audio-limit',
  'monthly-limit': 'audio-quota',
  'provider-quota': 'audio-quota',
};

export const GENERATING_RETRY_DELAY_MS = 1500;
const GENERATING_RETRIES = 2;

/**
 * Pide a la Edge Function la URL temporal del audio de una palabra. La función decide si lo
 * reutiliza o lo genera; desde aquí nunca se habla con ElevenLabs ni se reintenta una generación.
 */
@Injectable({ providedIn: 'root' })
export class PronunciationRepository {
  private readonly supabase = inject(SUPABASE);
  private readonly session = inject(SessionService);

  async getAudio(itemId: string): Promise<AudioSource> {
    await this.session.ensure();
    for (let attempt = 0; ; attempt++) {
      const { data, error } = await this.supabase.functions.invoke<{
        url?: unknown;
        expiresIn?: unknown;
      }>('pronounce', { body: { itemId } });

      if (!error) {
        if (typeof data?.url === 'string' && typeof data.expiresIn === 'number') {
          return { url: data.url, expiresAt: Date.now() + data.expiresIn * 1000 };
        }
        throw new AppError('audio-unavailable');
      }

      const code = await errorCode(error);
      // Otra petición está generando este mismo audio: se espera a que termine (sin coste extra).
      if (code === 'generating' && attempt < GENERATING_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, GENERATING_RETRY_DELAY_MS));
        continue;
      }
      throw new AppError(errorKind(error, code), undefined, error);
    }
  }
}

async function errorCode(error: unknown): Promise<string | null> {
  if (!(error instanceof FunctionsHttpError)) return null;
  const body = (await (error.context as Response)
    .clone()
    .json()
    .catch(() => null)) as { error?: unknown } | null;
  return typeof body?.error === 'string' ? body.error : null;
}

function errorKind(error: unknown, code: string | null): AppErrorKind {
  if (code) return ERROR_KINDS[code] ?? 'audio-unavailable';
  if (error instanceof FunctionsFetchError) return 'network';
  if (error instanceof FunctionsHttpError && (error.context as Response).status === 401) {
    return 'session';
  }
  return 'audio-unavailable';
}
