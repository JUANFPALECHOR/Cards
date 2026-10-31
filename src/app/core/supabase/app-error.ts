export type AppErrorKind =
  | 'network'
  | 'session'
  | 'invalid-credentials'
  | 'email-not-confirmed'
  | 'email-taken'
  | 'weak-password'
  | 'rate-limited'
  | 'signup-disabled'
  | 'audio-unavailable'
  | 'audio-busy'
  | 'audio-limit'
  | 'audio-quota'
  | 'not-found'
  | 'conflict'
  | 'validation'
  | 'unknown';

const MESSAGES: Record<AppErrorKind, string> = {
  network: 'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.',
  session: 'Tu sesión no es válida o expiró. Inicia sesión de nuevo.',
  'invalid-credentials': 'El correo o la contraseña no son correctos.',
  'email-not-confirmed':
    'Todavía no confirmaste tu correo. Abre el enlace que te enviamos e inténtalo de nuevo.',
  'email-taken': 'Ya existe una cuenta con ese correo. Inicia sesión o usa otro correo.',
  'weak-password':
    'La contraseña es demasiado débil. Usa al menos 8 caracteres y evita las comunes.',
  'rate-limited': 'Hiciste demasiados intentos. Espera unos minutos e inténtalo de nuevo.',
  'signup-disabled': 'El registro de cuentas nuevas está desactivado.',
  'audio-unavailable': 'El audio de esta palabra no está disponible en este momento.',
  'audio-busy': 'El audio se está preparando. Inténtalo de nuevo en unos segundos.',
  'audio-limit':
    'Alcanzaste el límite de audios nuevos por hoy. Los que ya escuchaste siguen disponibles.',
  'audio-quota':
    'Se agotó el cupo mensual de audios nuevos. Los que ya escuchaste siguen disponibles.',
  'not-found': 'No encontramos lo que buscas. Puede que se haya eliminado.',
  conflict: 'Ya existe un elemento con esos datos.',
  validation: 'Algunos datos no son válidos. Revísalos e inténtalo de nuevo.',
  unknown: 'Ocurrió un error inesperado. Inténtalo de nuevo.',
};

/** Error de aplicación con un mensaje apto para mostrar al usuario. */
export class AppError extends Error {
  constructor(
    readonly kind: AppErrorKind,
    message: string = MESSAGES[kind],
    override readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

interface ErrorLike {
  readonly code?: unknown;
  readonly message?: unknown;
  readonly status?: unknown;
}

/** Traduce errores de Supabase/PostgREST/red a un AppError comprensible. */
export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;

  const { code, message, status } = (error ?? {}) as ErrorLike;
  const text = typeof message === 'string' ? message : '';

  if (error instanceof TypeError || /failed to fetch|network|load failed/i.test(text)) {
    return new AppError('network', undefined, error);
  }
  switch (code) {
    case 'invalid_credentials':
      return new AppError('invalid-credentials', undefined, error);
    case 'email_not_confirmed':
      return new AppError('email-not-confirmed', undefined, error);
    case 'user_already_exists':
    case 'email_exists':
      return new AppError('email-taken', undefined, error);
    case 'weak_password':
      return new AppError('weak-password', undefined, error);
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return new AppError('rate-limited', undefined, error);
    case 'signup_disabled':
    case 'email_provider_disabled':
      return new AppError('signup-disabled', undefined, error);
    case 'email_address_invalid':
    case 'validation_failed':
      return new AppError('validation', undefined, error);
    case '23505':
      return new AppError('conflict', undefined, error);
    case 'PGRST116': // .single() sin filas
    case '22P02': // uuid con formato inválido en la URL
      return new AppError('not-found', undefined, error);
    case '23514': // check constraint
    case '23502': // not null
      return new AppError('validation', undefined, error);
  }
  if (status === 429) {
    return new AppError('rate-limited', undefined, error);
  }
  if (status === 401 || status === 403) {
    return new AppError('session', undefined, error);
  }
  return new AppError('unknown', undefined, error);
}

/** Desempaqueta la respuesta de supabase-js lanzando AppError si hubo error. */
export function unwrap<T>(response: { data: T; error: unknown }): T {
  if (response.error) {
    throw toAppError(response.error);
  }
  return response.data;
}
