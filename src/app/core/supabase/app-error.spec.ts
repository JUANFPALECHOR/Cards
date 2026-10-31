import { AppError, toAppError, unwrap } from './app-error';

describe('toAppError', () => {
  it('reconoce nombres duplicados (violación de unicidad)', () => {
    expect(toAppError({ code: '23505', message: 'duplicate key' }).kind).toBe('conflict');
  });

  it('trata como "no encontrado" la ausencia de filas y los uuid inválidos', () => {
    expect(toAppError({ code: 'PGRST116' }).kind).toBe('not-found');
    expect(toAppError({ code: '22P02' }).kind).toBe('not-found');
  });

  it('detecta errores de red', () => {
    expect(toAppError(new TypeError('Failed to fetch')).kind).toBe('network');
    expect(toAppError({ message: 'TypeError: Failed to fetch' }).kind).toBe('network');
  });

  it('traduce los errores de autenticación de Supabase', () => {
    const kindOf = (code: string, status = 400) => toAppError({ code, status }).kind;
    expect(kindOf('invalid_credentials')).toBe('invalid-credentials');
    expect(kindOf('email_not_confirmed')).toBe('email-not-confirmed');
    expect(kindOf('user_already_exists', 422)).toBe('email-taken');
    expect(kindOf('weak_password', 422)).toBe('weak-password');
    expect(kindOf('over_email_send_rate_limit', 429)).toBe('rate-limited');
    expect(kindOf('signup_disabled', 422)).toBe('signup-disabled');
    expect(toAppError({ message: 'too many', status: 429 }).kind).toBe('rate-limited');
  });

  it('no revela si el fallo fue el correo o la contraseña', () => {
    const { message } = toAppError({ code: 'invalid_credentials', status: 400 });
    expect(message).toBe('El correo o la contraseña no son correctos.');
  });

  it('devuelve un mensaje genérico en español para errores desconocidos', () => {
    const error = toAppError({ code: 'XX000', message: 'internal' });
    expect(error.kind).toBe('unknown');
    expect(error.message).toMatch(/inesperado/);
  });

  it('conserva un AppError existente', () => {
    const original = new AppError('validation');
    expect(toAppError(original)).toBe(original);
  });
});

describe('unwrap', () => {
  it('devuelve los datos o lanza un AppError', () => {
    expect(unwrap({ data: [1], error: null })).toEqual([1]);
    expect(() => unwrap({ data: null, error: { code: '23505' } })).toThrow(AppError);
  });
});
