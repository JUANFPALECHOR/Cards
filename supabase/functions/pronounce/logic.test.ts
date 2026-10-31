// Pruebas de la lógica pura. Ejecutar con: node --test supabase/functions/pronounce/logic.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_CONFIG,
  cacheKey,
  corsHeaders,
  mapProviderError,
  normalizeText,
  parseItemId,
  providerErrorDetail,
  readConfig,
  storagePath,
} from './logic.ts';

test('normaliza espacios y forma Unicode, conservando mayúsculas', () => {
  assert.equal(normalizeText('  Trouble   shooting \n'), 'Trouble shooting');
  assert.equal(normalizeText('VPN'), 'VPN');
  assert.equal(normalizeText('café'), 'café');
});

test('rechaza textos vacíos, sin letras o demasiado largos', () => {
  assert.equal(normalizeText('   '), null);
  assert.equal(normalizeText('123 !!'), null);
  assert.equal(normalizeText('a'.repeat(201)), null);
  assert.equal(normalizeText('a'.repeat(200)), 'a'.repeat(200));
});

test('la clave es estable y cambia con el texto, la voz o el modelo', async () => {
  const base = await cacheKey('Troubleshooting', DEFAULT_CONFIG);
  assert.match(base, /^[0-9a-f]{64}$/);
  assert.equal(await cacheKey('Troubleshooting', DEFAULT_CONFIG), base);
  assert.notEqual(await cacheKey('troubleshooting', DEFAULT_CONFIG), base);
  assert.notEqual(await cacheKey('Troubleshooting', { ...DEFAULT_CONFIG, voiceId: 'otra' }), base);
  assert.notEqual(
    await cacheKey('Troubleshooting', { ...DEFAULT_CONFIG, modelId: 'eleven_v3' }),
    base,
  );
  assert.equal(storagePath(base, DEFAULT_CONFIG), `v1/${DEFAULT_CONFIG.voiceId}/${base}.mp3`);
});

test('solo acepta un itemId con formato UUID', () => {
  const id = '6704E229-8E15-40A3-9395-6046B31480F0';
  assert.equal(parseItemId({ itemId: id }), id.toLowerCase());
  assert.equal(parseItemId({ itemId: 'x' }), null);
  assert.equal(parseItemId({ text: 'Hola' }), null);
  assert.equal(parseItemId(null), null);
});

test('lee la configuración del entorno e ignora valores inválidos', () => {
  const env: Record<string, string> = {
    ELEVENLABS_VOICE_ID: 'abc123',
    PRONOUNCE_DAILY_LIMIT: '5',
    PRONOUNCE_MONTHLY_CHAR_LIMIT: '-3',
    ELEVENLABS_MODEL_ID: 'modelo con espacios',
    PRONOUNCE_ALLOWED_ORIGINS: 'http://localhost:4200, https://ejemplo.app',
  };
  const config = readConfig((name) => env[name]);
  assert.equal(config.voiceId, 'abc123');
  assert.equal(config.dailyLimit, 5);
  assert.equal(config.monthlyCharLimit, DEFAULT_CONFIG.monthlyCharLimit);
  assert.equal(config.modelId, DEFAULT_CONFIG.modelId);
  assert.deepEqual(config.allowedOrigins, ['http://localhost:4200', 'https://ejemplo.app']);
  assert.deepEqual(
    readConfig(() => undefined),
    DEFAULT_CONFIG,
  );
});

test('traduce los errores de ElevenLabs', () => {
  assert.equal(mapProviderError(402, 'insufficient_credits', ''), 'provider-quota');
  assert.equal(mapProviderError(401, 'quota_exceeded', ''), 'provider-quota');
  assert.equal(mapProviderError(404, 'voice_not_found', ''), 'voice-unavailable');
  assert.equal(
    mapProviderError(402, 'payment_required', 'Free users cannot use library voices via the API'),
    'voice-unavailable',
  );
  assert.equal(mapProviderError(401, 'invalid_api_key', ''), 'not-configured');
  assert.equal(mapProviderError(401, 'missing_permissions', ''), 'not-configured');
  assert.equal(mapProviderError(429, 'concurrent_limit_exceeded', ''), 'provider-busy');
  assert.equal(mapProviderError(500, '', 'boom'), 'provider-error');
});

test('lee el detalle de error en el formato nuevo y en el antiguo', () => {
  assert.deepEqual(
    providerErrorDetail({ detail: { type: 'x', code: 'insufficient_credits', message: 'm' } }),
    { code: 'insufficient_credits', message: 'm' },
  );
  assert.deepEqual(providerErrorDetail({ detail: { status: 'quota_exceeded', message: 'q' } }), {
    code: 'quota_exceeded',
    message: 'q',
  });
  assert.deepEqual(providerErrorDetail(null), { code: '', message: '' });
});

test('CORS: solo refleja orígenes permitidos', () => {
  assert.equal(
    corsHeaders('http://localhost:4200', DEFAULT_CONFIG)['Access-Control-Allow-Origin'],
    'http://localhost:4200',
  );
  assert.equal(
    corsHeaders('https://otro.sitio', DEFAULT_CONFIG)['Access-Control-Allow-Origin'],
    undefined,
  );
});
