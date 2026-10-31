// Edge Function `pronounce`: devuelve una URL temporal del audio de una palabra del usuario.
// Si el audio no existe, lo genera una sola vez con ElevenLabs y lo guarda en Storage.
// La clave de ElevenLabs y la clave secreta de Supabase solo existen aquí (secretos del servidor).
import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import {
  ERROR_STATUS,
  type ErrorCode,
  cacheKey,
  corsHeaders,
  mapProviderError,
  normalizeText,
  parseItemId,
  providerErrorDetail,
  readConfig,
  storagePath,
} from './logic.ts';

const BUCKET = 'pronunciations';
const SIGNED_URL_SECONDS = 3600;
const ELEVENLABS_API = 'https://api.elevenlabs.io/v1';

const config = readConfig((name) => Deno.env.get(name));
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
// En Cards el secreto se creó con el nombre `ElevenLabs` (no se puede renombrar); se acepta
// también el nombre convencional por si en el futuro se crea así.
const ELEVENLABS_KEY_NAMES = ['ELEVENLABS_API_KEY', 'ElevenLabs'];
const elevenLabsKeySource =
  ELEVENLABS_KEY_NAMES.find((name) => (Deno.env.get(name) ?? '').trim().length > 0) ?? null;
const elevenLabsKey = elevenLabsKeySource ? (Deno.env.get(elevenLabsKeySource) ?? '').trim() : '';
const secretKey = projectKey('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY');
const publishableKey = projectKey('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY');

// Solo booleanos: nunca se registran valores de claves.
console.log(
  JSON.stringify({
    event: 'boot',
    elevenLabsKeyPresent: elevenLabsKey.length > 0,
    elevenLabsKeySource,
    supabaseSecretKeyPresent: secretKey.length > 0,
    supabasePublishableKeyPresent: publishableKey.length > 0,
    voiceId: config.voiceId,
    modelId: config.modelId,
  }),
);

const admin = createClient(supabaseUrl, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** La voz se comprueba antes de la primera generación de cada instancia (no consume créditos). */
let voiceCheck: 'ok' | 'unverifiable' | null = null;

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  const cors = corsHeaders(origin, config, req.headers.get('Access-Control-Request-Headers'));
  const json = (status: number, body: Record<string, unknown>) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  const fail = (code: ErrorCode) => json(ERROR_STATUS[code], { error: code });

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return fail('method-not-allowed');

  // 1. Usuario autenticado (no anónimo). La plataforma deja pasar peticiones que solo traen la
  //    clave publicable, así que la sesión se valida siempre aquí, antes de cualquier otra cosa.
  const authorization = req.headers.get('Authorization') ?? '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!token || token.startsWith('sb_') || !publishableKey) return fail('unauthorized');
  const userClient = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser(token);
  const user = userData?.user;
  if (userError || !user) return fail('unauthorized');
  if (user.is_anonymous) return fail('forbidden');

  // La configuración solo se revela a usuarios autenticados.
  if (!elevenLabsKey || !secretKey) {
    log({ outcome: 'not-configured' });
    return fail('not-configured');
  }

  // 2. La palabra debe pertenecer al usuario (RLS): no se acepta texto libre.
  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    return fail('invalid-request');
  }
  const itemId = parseItemId(body);
  if (!itemId) return fail('invalid-request');
  const { data: item, error: itemError } = await userClient
    .from('vocabulary_items')
    .select('term')
    .eq('id', itemId)
    .maybeSingle();
  if (itemError || !item) return fail('item-not-found');
  const text = normalizeText(item.term);
  if (!text) return fail('invalid-request');

  // 3. ¿Ya existe? Si no, se reserva la generación (límites y concurrencia en una sola transacción).
  const key = await cacheKey(text, config);
  const path = storagePath(key, config);
  const { data: claim, error: claimError } = await admin.rpc('claim_pronunciation_audio', {
    p_cache_key: key,
    p_storage_path: path,
    p_text: text,
    p_voice_id: config.voiceId,
    p_model_id: config.modelId,
    p_user_id: user.id,
    p_daily_limit: config.dailyLimit,
    p_monthly_char_limit: config.monthlyCharLimit,
  });
  if (claimError) {
    log({ outcome: 'claim-error', message: claimError.message });
    return fail('storage-error');
  }

  if (claim === 'ready') return signedUrlResponse(path, true, json, fail);
  if (claim === 'pending') return fail('generating');
  if (claim === 'daily-limit' || claim === 'monthly-limit') {
    log({ outcome: claim, user: user.id });
    return fail(claim);
  }

  // 4. Esta petición genera el audio. Ante cualquier fallo se libera la reserva.
  const started = Date.now();
  const generated = await generate(text);
  if ('error' in generated) {
    await release(key);
    return fail(generated.error);
  }

  const upload = await admin.storage.from(BUCKET).upload(path, generated.audio, {
    contentType: 'audio/mpeg',
    cacheControl: '31536000',
    upsert: true,
  });
  if (upload.error) {
    log({ outcome: 'upload-error', message: upload.error.message });
    await release(key);
    return fail('storage-error');
  }

  const { error: readyError } = await admin
    .from('pronunciation_audio')
    .update({
      status: 'ready',
      completed_at: new Date().toISOString(),
      provider_cost: generated.cost,
    })
    .eq('cache_key', key);
  if (readyError) log({ outcome: 'mark-ready-error', message: readyError.message });

  log({
    outcome: 'generated',
    characters: text.length,
    providerCost: generated.cost,
    bytes: generated.audio.byteLength,
    requestId: generated.requestId,
    ms: Date.now() - started,
  });
  return signedUrlResponse(path, false, json, fail);
});

async function signedUrlResponse(
  path: string,
  cached: boolean,
  json: (status: number, body: Record<string, unknown>) => Response,
  fail: (code: ErrorCode) => Response,
): Promise<Response> {
  const { data, error } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_SECONDS);
  if (error || !data) {
    log({ outcome: 'sign-error', cached, message: error?.message });
    return fail('storage-error');
  }
  if (cached) log({ outcome: 'cached' });
  return json(200, { url: data.signedUrl, expiresIn: SIGNED_URL_SECONDS, cached });
}

type Generation =
  { audio: Uint8Array; cost: number | null; requestId: string | null } | { error: ErrorCode };

async function generate(text: string): Promise<Generation> {
  const voiceError = await ensureVoice();
  if (voiceError) return { error: voiceError };

  let response: Response;
  try {
    response = await fetch(
      `${ELEVENLABS_API}/text-to-speech/${config.voiceId}?output_format=${config.outputFormat}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': elevenLabsKey,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          text,
          model_id: config.modelId,
          language_code: config.languageCode,
        }),
        signal: AbortSignal.timeout(20_000),
      },
    );
  } catch (error) {
    log({ outcome: 'provider-network-error', message: String(error) });
    return { error: 'provider-error' };
  }

  if (!response.ok) {
    const detail = providerErrorDetail(await response.json().catch(() => null));
    const code = mapProviderError(response.status, detail.code, detail.message);
    log({
      outcome: code,
      status: response.status,
      providerCode: detail.code,
      message: detail.message,
    });
    return { error: code };
  }

  const audio = new Uint8Array(await response.arrayBuffer());
  if (audio.byteLength === 0) {
    log({ outcome: 'provider-empty-audio' });
    return { error: 'provider-error' };
  }
  // ElevenLabs informa en esta cabecera los créditos cobrados por la solicitud.
  const costHeader = response.headers.get('character-cost');
  return {
    audio,
    cost: costHeader && /^\d+$/.test(costHeader) ? Number(costHeader) : null,
    requestId: response.headers.get('request-id'),
  };
}

/** Comprueba que la voz existe para esta cuenta. Si la clave no permite leer voces, se omite. */
async function ensureVoice(): Promise<ErrorCode | null> {
  if (voiceCheck) return null;
  try {
    const response = await fetch(`${ELEVENLABS_API}/voices/${config.voiceId}`, {
      headers: { 'xi-api-key': elevenLabsKey },
      signal: AbortSignal.timeout(10_000),
    });
    if (response.ok) {
      const voice = (await response.json().catch(() => ({}))) as {
        name?: string;
        category?: string;
        labels?: Record<string, string>;
      };
      voiceCheck = 'ok';
      log({
        outcome: 'voice-ok',
        name: voice.name,
        category: voice.category,
        labels: voice.labels,
      });
      return null;
    }
    const detail = providerErrorDetail(await response.json().catch(() => null));
    log({
      outcome: 'voice-check',
      status: response.status,
      providerCode: detail.code,
      message: detail.message,
    });
    if (response.status === 401 && detail.code === 'missing_permissions') {
      voiceCheck = 'unverifiable';
      return null;
    }
    if (response.status === 404 || response.status === 400) return 'voice-unavailable';
    return mapProviderError(response.status, detail.code, detail.message);
  } catch (error) {
    log({ outcome: 'voice-check-network-error', message: String(error) });
    return 'provider-error';
  }
}

async function release(key: string): Promise<void> {
  const { error } = await admin
    .from('pronunciation_audio')
    .delete()
    .eq('cache_key', key)
    .eq('status', 'pending');
  if (error) log({ outcome: 'release-error', message: error.message });
}

function projectKey(jsonName: string, legacyName: string): string {
  const keys = Deno.env.get(jsonName);
  if (keys) {
    try {
      const value = (JSON.parse(keys) as Record<string, string>)['default'];
      if (value) return value;
    } catch {
      // Formato inesperado: se usa la variable heredada.
    }
  }
  return Deno.env.get(legacyName) ?? '';
}

function log(entry: Record<string, unknown>): void {
  console.log(JSON.stringify({ event: 'pronounce', ...entry }));
}
