import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { AuthService } from './auth.service';

/** Solo rutas internas: evita redirigir a "//sitio.externo" desde un returnUrl manipulado. */
export function safeReturnUrl(value: unknown): string | null {
  return typeof value === 'string' && /^\/(?![/\\])/.test(value) ? value : null;
}

/** Exige sesión iniciada; si no la hay, lleva a /login recordando la ruta pedida. */
export const authGuard: CanActivateFn = async (_route, state): Promise<boolean | UrlTree> => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.initialize();
  if (auth.status() === 'signed-in') return true;
  const returnUrl = state.url === '/' || state.url === '/sets' ? undefined : state.url;
  return router.createUrlTree(['/login'], { queryParams: returnUrl ? { returnUrl } : {} });
};

/** Pantallas de acceso: quien ya tiene sesión va directo a sus conjuntos. */
export const guestGuard: CanActivateFn = async (): Promise<boolean | UrlTree> => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.initialize();
  return auth.status() === 'signed-in' ? router.createUrlTree(['/sets']) : true;
};
