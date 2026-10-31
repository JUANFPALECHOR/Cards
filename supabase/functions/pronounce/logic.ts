// Lógica pura de la función `pronounce`: sin APIs de Deno ni de red, para poder probarla aislada.

export interface PronounceConfig {
  readonly voiceId: string;
  readonly modelId: string;
  readonly outputFormat: string;
  readonly languageCode: string;
  readonly dailyLimit: number;
  readonly monthlyCharLimit: number;
  readonly allowedOrigins: readonly string[];
}

export const DEFAULT_CONFIG: PronounceConfig = {
  // Matilda: voz predefinida de ElevenLabs, inglés estadounidense, estilo educativo.
  voiceId: 'XrExE9yKIg1WjnnlVkGX',
  modelId: 'eleven_flash_v2_5',
  // MP3 mono de 32 kbps: una palabra ocupa unos pocos KB.
  outputFormat: 'mp3_22050_32',
  languageCode: 'en',
  dailyLimit: 40,
  monthlyCharLimit: 15000,
  allowedOrigins: ['http://localhost:4200'],
};

export const TEXT_MAX = 200;

/** Configuración a partir de variables de entorno (opcionales), con valores por defecto seguros. */
export function readConfig(env: (name: string) => string | undefined): PronounceConfig {
  const positiveInt = (value: string | undefined, fallback: number): number => {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
  };
  const voiceId = env('ELEVENLABS_VOICE_ID')?.trim();
  const modelId = env('ELEVENLABS_MODEL_ID')?.trim();
  const origins = env('PRONOUNCE_ALLOWED_ORIGINS')
    ?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  return {
    ...DEFAULT_CONFIG,
    voiceId: voiceId && /^[A-Za-z0-9]+$/.test(voiceId) ? voiceId : DEFAULT_CONFIG.voiceId,
    modelId: modelId && /^[a-z0-9_]+$/.test(modelId) ? modelId : DEFAULT_CONFIG.modelId,
    dailyLimit: positiveInt(env('PRONOUNCE_DAILY_LIMIT'), DEFAULT_CONFIG.dailyLimit),
    monthlyCharLimit: positiveInt(
      env('PRONOUNCE_MONTHLY_CHAR_LIMIT'),
      DEFAULT_CONFIG.monthlyCharLimit,
    ),
    allowedOrigins: origins?.length ? origins : DEFAULT_CONFIG.allowedOrigins,
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Extrae el id de la palabra del cuerpo de la petición; null si no es válido. */
export function parseItemId(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return null;
  const itemId = (body as { itemId?: unknown }).itemId;
  return typeof itemId === 'string' && UUID.test(itemId) ? itemId.toLowerCase() : null;
}

/**
 * Texto que se envía a ElevenLabs. Se conservan mayúsculas (siglas como «VPN» se leen distinto)
 * y solo se unifican espacios y la forma Unicode, para que el mismo texto dé la misma clave.
 */
export function normalizeText(term: string): string | null {
  const text = term.normalize('NFC').replace(/\s+/g, ' ').trim();
  if (!text || text.length > TEXT_MAX || !/\p{L}/u.test(text)) return null;
  return text;
}

/** Clave estable del audio: cambia si cambia el texto, la voz, el modelo, el formato o el idioma. */
export async function cacheKey(text: string, config: PronounceConfig): Promise<string> {
  const material = [
    'pronounce-v1',
    config.voiceId,
    config.modelId,
    config.outputFormat,
    config.languageCode,
    text,
  ].join('\n');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(material));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function storagePath(key: string, config: PronounceConfig): string {
  return `v1/${config.voiceId}/${key}.mp3`;
}

export type ErrorCode =
  | 'invalid-request'
  | 'unauthorized'
  | 'forbidden'
  | 'item-not-found'
  | 'method-not-allowed'
  | 'generating'
  | 'daily-limit'
  | 'monthly-limit'
  | 'not-configured'
  | 'voice-unavailable'
  | 'provider-quota'
  | 'provider-plan'
  | 'provider-busy'
  | 'provider-error'
  | 'storage-error';

export const ERROR_STATUS: Record<ErrorCode, number> = {
  'invalid-request': 400,
  unauthorized: 401,
  forbidden: 403,
  'item-not-found': 404,
  'method-not-allowed': 405,
  generating: 409,
  'daily-limit': 429,
  'monthly-limit': 429,
  'not-configured': 503,
  'voice-unavailable': 503,
  'provider-quota': 503,
  'provider-plan': 503,
  'provider-busy': 503,
  'provider-error': 502,
  'storage-error': 502,
};

/** Detalle de un error de ElevenLabs: formato nuevo ({type, code}) y antiguo ({status}). */
export function providerErrorDetail(body: unknown): { code: string; message: string } {
  const detail = (body as { detail?: unknown } | null)?.detail;
  if (typeof detail === 'string') return { code: '', message: detail };
  const record = (detail ?? {}) as { code?: unknown; status?: unknown; message?: unknown };
  const code = typeof record.code === 'string' ? record.code : record.status;
  return {
    code: typeof code === 'string' ? code : '',
    message: typeof record.message === 'string' ? record.message : '',
  };
}

/** Traduce una respuesta de error de ElevenLabs a un código propio (sin reintentos automáticos). */
export function mapProviderError(status: number, code: string, message: string): ErrorCode {
  if (code === 'insufficient_credits' || code === 'quota_exceeded') return 'provider-quota';
  if (/voice|library/i.test(`${code} ${message}`)) return 'voice-unavailable';
  if (status === 401 || status === 403) return 'not-configured';
  if (status === 402) return 'provider-plan';
  if (status === 429) return 'provider-busy';
  return 'provider-error';
}

/** CORS solo para los orígenes permitidos (la protección real es el JWT). */
export function corsHeaders(
  origin: string | null,
  config: PronounceConfig,
  requestedHeaders: string | null = null,
): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers':
      requestedHeaders ?? 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
  if (origin && config.allowedOrigins.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}
