import { Injectable, computed, inject, signal } from '@angular/core';
import { User } from '@supabase/supabase-js';
import { AppError, toAppError } from '../supabase/app-error';
import { SUPABASE } from '../supabase/supabase.client';

export type AuthStatus = 'loading' | 'signed-in' | 'signed-out';

export interface Credentials {
  readonly email: string;
  readonly password: string;
}

/** Resultado del registro: con "Confirm email" activo no hay sesión hasta abrir el enlace del correo. */
export type SignUpResult = 'signed-in' | 'confirmation-required';

/** Estado de autenticación (Supabase Auth, correo y contraseña) expuesto como signals. */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly supabase = inject(SUPABASE);

  private readonly current = signal<User | null>(null);
  private readonly ready = signal(false);
  private initialization: Promise<void> | null = null;

  readonly status = computed<AuthStatus>(() =>
    !this.ready() ? 'loading' : this.current() ? 'signed-in' : 'signed-out',
  );
  readonly userId = computed(() => this.current()?.id ?? null);
  readonly email = computed(() => this.current()?.email ?? null);

  /** Restaura la sesión guardada y empieza a escuchar cambios (otras pestañas, expiración). Idempotente. */
  initialize(): Promise<void> {
    this.initialization ??= this.restore();
    return this.initialization;
  }

  async signIn({ email, password }: Credentials): Promise<void> {
    const { data, error } = await this.supabase.auth.signInWithPassword({ email, password });
    if (error) throw toAppError(error);
    this.current.set(data.user);
  }

  async signUp({ email, password }: Credentials): Promise<SignUpResult> {
    const { data, error } = await this.supabase.auth.signUp({ email, password });
    if (error) throw toAppError(error);
    // Con la confirmación activada, un correo ya registrado devuelve un usuario sin identidades.
    if (data.user && (data.user.identities?.length ?? 1) === 0) throw new AppError('email-taken');
    if (!data.session) return 'confirmation-required';
    this.current.set(data.session.user);
    return 'signed-in';
  }

  async signOut(): Promise<void> {
    const { error } = await this.supabase.auth.signOut();
    if (error) throw toAppError(error);
  }

  private async restore(): Promise<void> {
    // El callback solo actualiza signals: llamar a otros métodos de auth aquí podría bloquear el cliente.
    this.supabase.auth.onAuthStateChange((_event, session) => {
      this.current.set(session?.user && !session.user.is_anonymous ? session.user : null);
    });

    try {
      const { data, error } = await this.supabase.auth.getSession();
      if (error) throw error;
      const user = data.session?.user ?? null;
      if (user?.is_anonymous) {
        // Sesión anónima de versiones anteriores: ya no se usa; se descarta solo en este navegador.
        await this.supabase.auth.signOut({ scope: 'local' });
      } else {
        this.current.set(user);
      }
    } catch {
      this.current.set(null);
    } finally {
      this.ready.set(true);
    }
  }
}
