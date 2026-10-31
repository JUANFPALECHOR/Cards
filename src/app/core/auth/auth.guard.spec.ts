import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { provideRouter } from '@angular/router';
import { createAuthStub } from '../../../testing/auth-stub';
import { AuthService } from './auth.service';
import { authGuard, guestGuard, safeReturnUrl } from './auth.guard';

const route = {} as ActivatedRouteSnapshot;
const stateOf = (url: string) => ({ url }) as RouterStateSnapshot;

function run(guard: typeof authGuard, url: string, userId: string | null) {
  const auth = createAuthStub(userId);
  TestBed.configureTestingModule({
    providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
  });
  return TestBed.runInInjectionContext(
    () => guard(route, stateOf(url)) as Promise<boolean | UrlTree>,
  );
}

describe('authGuard', () => {
  it('deja pasar a quien tiene sesión', async () => {
    expect(await run(authGuard, '/review', 'user-1')).toBe(true);
  });

  it('lleva a /login recordando la ruta pedida', async () => {
    const result = await run(authGuard, '/sets/abc/quiz', null);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe(
      '/login?returnUrl=%2Fsets%2Fabc%2Fquiz',
    );
  });

  it('no añade returnUrl cuando el destino es la pantalla de inicio', async () => {
    const result = await run(authGuard, '/sets', null);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/login');
  });
});

describe('guestGuard', () => {
  it('permite ver el acceso a quien no tiene sesión', async () => {
    expect(await run(guestGuard, '/login', null)).toBe(true);
  });

  it('envía a /sets a quien ya inició sesión', async () => {
    const result = await run(guestGuard, '/login', 'user-1');
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/sets');
  });
});

describe('safeReturnUrl', () => {
  it('acepta solo rutas internas', () => {
    expect(safeReturnUrl('/sets/abc')).toBe('/sets/abc');
    expect(safeReturnUrl('/review?x=1')).toBe('/review?x=1');
  });

  it('rechaza destinos externos o ambiguos', () => {
    expect(safeReturnUrl('//sitio.externo')).toBeNull();
    expect(safeReturnUrl('/\\sitio.externo')).toBeNull();
    expect(safeReturnUrl('https://sitio.externo')).toBeNull();
    expect(safeReturnUrl('sets')).toBeNull();
    expect(safeReturnUrl(undefined)).toBeNull();
  });
});
