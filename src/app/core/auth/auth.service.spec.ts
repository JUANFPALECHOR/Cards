import { TestBed } from '@angular/core/testing';
import { AppError } from '../supabase/app-error';
import { SUPABASE } from '../supabase/supabase.client';
import { AuthService } from './auth.service';

type Listener = (event: string, session: unknown) => void;

function fakeUser(overrides: Record<string, unknown> = {}) {
  return { id: 'user-1', email: 'ana@correo.com', is_anonymous: false, ...overrides };
}

function setup(session: { user: ReturnType<typeof fakeUser> } | null = null) {
  let listener: Listener = () => undefined;
  const auth = {
    getSession: vi.fn().mockResolvedValue({ data: { session }, error: null }),
    onAuthStateChange: vi.fn((callback: Listener) => {
      listener = callback;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    }),
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn().mockResolvedValue({ error: null }),
  };
  TestBed.configureTestingModule({ providers: [{ provide: SUPABASE, useValue: { auth } }] });
  return {
    service: TestBed.inject(AuthService),
    auth,
    emit: (e: string, s: unknown) => listener(e, s),
  };
}

describe('AuthService', () => {
  it('queda en "loading" hasta restaurar la sesión y luego refleja al usuario', async () => {
    const { service } = setup({ user: fakeUser() });
    expect(service.status()).toBe('loading');

    await service.initialize();

    expect(service.status()).toBe('signed-in');
    expect(service.userId()).toBe('user-1');
    expect(service.email()).toBe('ana@correo.com');
  });

  it('queda sin sesión cuando no hay nada guardado', async () => {
    const { service } = setup(null);
    await service.initialize();
    expect(service.status()).toBe('signed-out');
    expect(service.userId()).toBeNull();
  });

  it('descarta localmente una sesión anónima heredada', async () => {
    const { service, auth } = setup({ user: fakeUser({ is_anonymous: true }) });

    await service.initialize();

    expect(service.status()).toBe('signed-out');
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('inicializa una sola vez aunque se pida varias', async () => {
    const { service, auth } = setup(null);
    await Promise.all([service.initialize(), service.initialize()]);
    expect(auth.getSession).toHaveBeenCalledTimes(1);
    expect(auth.onAuthStateChange).toHaveBeenCalledTimes(1);
  });

  it('reacciona a un cierre de sesión ocurrido en otra pestaña', async () => {
    const { service, emit } = setup({ user: fakeUser() });
    await service.initialize();

    emit('SIGNED_OUT', null);

    expect(service.status()).toBe('signed-out');
  });

  describe('signIn', () => {
    it('traduce credenciales incorrectas a un mensaje claro', async () => {
      const { service, auth } = setup(null);
      auth.signInWithPassword.mockResolvedValue({
        data: { user: null },
        error: { code: 'invalid_credentials', status: 400, message: 'Invalid login credentials' },
      });

      await expect(service.signIn({ email: 'a@b.co', password: 'x' })).rejects.toMatchObject({
        kind: 'invalid-credentials',
      });
    });

    it('guarda al usuario al acertar', async () => {
      const { service, auth } = setup(null);
      auth.signInWithPassword.mockResolvedValue({ data: { user: fakeUser() }, error: null });
      await service.initialize();

      await service.signIn({ email: 'ana@correo.com', password: 'secreta123' });

      expect(service.status()).toBe('signed-in');
    });
  });

  describe('signUp', () => {
    const credentials = { email: 'ana@correo.com', password: 'secreta123' };

    it('inicia sesión de inmediato cuando el proyecto no exige confirmar el correo', async () => {
      const { service, auth } = setup(null);
      const user = fakeUser({ identities: [{}] });
      auth.signUp.mockResolvedValue({ data: { user, session: { user } }, error: null });
      await service.initialize();

      await expect(service.signUp(credentials)).resolves.toBe('signed-in');
      expect(service.status()).toBe('signed-in');
    });

    it('pide confirmar el correo cuando no se devuelve sesión', async () => {
      const { service, auth } = setup(null);
      auth.signUp.mockResolvedValue({
        data: { user: fakeUser({ identities: [{}] }), session: null },
        error: null,
      });
      await service.initialize();

      await expect(service.signUp(credentials)).resolves.toBe('confirmation-required');
      expect(service.status()).toBe('signed-out');
    });

    it('detecta un correo ya registrado (usuario sin identidades)', async () => {
      const { service, auth } = setup(null);
      auth.signUp.mockResolvedValue({
        data: { user: fakeUser({ identities: [] }), session: null },
        error: null,
      });

      const result = service.signUp(credentials);

      await expect(result).rejects.toBeInstanceOf(AppError);
      await expect(result).rejects.toMatchObject({ kind: 'email-taken' });
    });
  });

  it('cierra la sesión y propaga los errores traducidos', async () => {
    const { service, auth } = setup(null);
    auth.signOut.mockResolvedValue({ error: { message: 'Failed to fetch' } });
    await expect(service.signOut()).rejects.toMatchObject({ kind: 'network' });
  });
});
