import { Injectable, InjectionToken, effect, inject, signal, untracked } from '@angular/core';
import { AuthService } from '../../../core/auth/auth.service';
import { ToastService } from '../../../core/feedback/toast.service';
import { AppError, toAppError } from '../../../core/supabase/app-error';
import { AudioSource, PronunciationRepository } from '../data/pronunciation.repository';

export type PlaybackRate = 1 | 0.75;

export interface PlaybackState {
  readonly key: string;
  readonly rate: PlaybackRate;
  readonly phase: 'loading' | 'playing';
}

/** Crea el elemento de audio; las pruebas lo sustituyen por un doble. */
export const AUDIO_ELEMENT_FACTORY = new InjectionToken<() => HTMLAudioElement>(
  'AUDIO_ELEMENT_FACTORY',
  { providedIn: 'root', factory: () => () => new Audio() },
);

/** Margen para no reproducir una URL firmada a punto de caducar. */
const EXPIRY_MARGIN_MS = 60_000;

/** La clave incluye el texto: si se edita la palabra no se reutiliza el audio anterior. */
export function pronunciationKey(itemId: string, term: string): string {
  return `${itemId}\n${term}`;
}

/**
 * Reproductor único de pronunciaciones: solo suena una palabra a la vez.
 * Las URL se guardan en memoria, así que repetir una palabra no vuelve a llamar al servidor.
 * La velocidad lenta usa el mismo archivo (playbackRate), sin generar otro audio.
 */
@Injectable({ providedIn: 'root' })
export class PronunciationPlayer {
  private readonly repository = inject(PronunciationRepository);
  private readonly toasts = inject(ToastService);
  private readonly createAudio = inject(AUDIO_ELEMENT_FACTORY);
  private readonly auth = inject(AuthService);

  private readonly current = signal<PlaybackState | null>(null);
  readonly state = this.current.asReadonly();

  private audio: HTMLAudioElement | null = null;
  private readonly sources = new Map<string, AudioSource>();
  private readonly pending = new Map<string, Promise<AudioSource>>();
  /** Cada reproducción invalida a las anteriores que todavía estén cargando. */
  private token = 0;

  constructor() {
    let previous: string | null | undefined;
    effect(() => {
      const userId = this.auth.userId();
      untracked(() => {
        if (previous !== undefined && previous !== userId) {
          this.stop();
          this.sources.clear();
        }
        previous = userId;
      });
    });
  }

  /** Reproduce la palabra; si ya suena (o carga) con esa misma velocidad, la detiene. */
  toggle(itemId: string, term: string, rate: PlaybackRate): Promise<void> {
    const key = pronunciationKey(itemId, term);
    const state = this.current();
    if (state?.key === key && state.rate === rate) {
      this.stop();
      return Promise.resolve();
    }
    return this.play(key, itemId, rate);
  }

  stop(): void {
    this.token++;
    this.audio?.pause();
    this.current.set(null);
  }

  /** Detiene solo si lo que suena es esta palabra (p. ej. al pasar a otra tarjeta). */
  stopIfCurrent(itemId: string, term: string): void {
    if (this.current()?.key === pronunciationKey(itemId, term)) this.stop();
  }

  private async play(key: string, itemId: string, rate: PlaybackRate): Promise<void> {
    const token = ++this.token;
    const audio = this.element();
    audio.pause();
    this.current.set({ key, rate, phase: 'loading' });

    let source: AudioSource;
    try {
      source = await this.source(key, itemId);
    } catch (error) {
      if (token === this.token) {
        this.current.set(null);
        this.toasts.error(toAppError(error).message);
      }
      return;
    }
    if (token !== this.token) return;

    if (audio.src === source.url) {
      audio.currentTime = 0;
    } else {
      audio.src = source.url;
    }
    // Cambiar `src` devuelve playbackRate al valor por defecto: se fijan ambos.
    audio.defaultPlaybackRate = rate;
    audio.playbackRate = rate;

    try {
      await audio.play();
      if (token === this.token) this.current.set({ key, rate, phase: 'playing' });
    } catch (error) {
      if (token !== this.token) return;
      this.current.set(null);
      const name = (error as { name?: string } | null)?.name;
      if (name === 'NotAllowedError') {
        // iOS exige un toque directo: la URL ya está lista, el siguiente toque suena al instante.
        this.toasts.info('El audio está listo. Toca de nuevo para escucharlo.');
      } else if (name !== 'AbortError') {
        this.sources.delete(key);
        this.toasts.error(new AppError('audio-unavailable').message);
      }
    }
  }

  private source(key: string, itemId: string): Promise<AudioSource> {
    const cached = this.sources.get(key);
    if (cached && cached.expiresAt - EXPIRY_MARGIN_MS > Date.now()) return Promise.resolve(cached);

    let request = this.pending.get(key);
    if (!request) {
      request = this.repository
        .getAudio(itemId)
        .then((source) => {
          this.sources.set(key, source);
          return source;
        })
        .finally(() => this.pending.delete(key));
      this.pending.set(key, request);
    }
    return request;
  }

  private element(): HTMLAudioElement {
    if (!this.audio) {
      const audio = this.createAudio();
      audio.preload = 'auto';
      audio.addEventListener('ended', () => {
        if (this.current()?.phase === 'playing') this.current.set(null);
      });
      this.audio = audio;
    }
    return this.audio;
  }
}
