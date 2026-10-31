import { Injectable, inject } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { AppError } from '../supabase/app-error';

/** Id del usuario autenticado, que es el propietario de las filas (RLS). */
@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly auth = inject(AuthService);

  /** Devuelve el id del usuario o lanza AppError('session') si no hay sesión iniciada. */
  async ensure(): Promise<string> {
    await this.auth.initialize();
    const id = this.auth.userId();
    if (!id) throw new AppError('session');
    return id;
  }
}
