import { TestBed } from '@angular/core/testing';
import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js';
import { SessionService } from '../../../core/session/session.service';
import { SUPABASE } from '../../../core/supabase/supabase.client';
import { GENERATING_RETRY_DELAY_MS, PronunciationRepository } from './pronunciation.repository';

const ITEM = '6704e229-8e15-40a3-9395-6046b31480f0';

function httpError(status: number, body: unknown): FunctionsHttpError {
  return new FunctionsHttpError(new Response(JSON.stringify(body), { status }));
}

describe('PronunciationRepository', () => {
  let invoke: ReturnType<typeof vi.fn>;
  let repository: PronunciationRepository;

  beforeEach(() => {
    invoke = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        { provide: SUPABASE, useValue: { functions: { invoke } } },
        { provide: SessionService, useValue: { ensure: vi.fn().mockResolvedValue('user-1') } },
      ],
    });
    repository = TestBed.inject(PronunciationRepository);
  });

  afterEach(() => vi.useRealTimers());

  it('envía solo el id de la palabra y devuelve la URL con su caducidad', async () => {
    invoke.mockResolvedValue({ data: { url: 'https://x/a.mp3', expiresIn: 3600 }, error: null });

    const before = Date.now();
    const source = await repository.getAudio(ITEM);

    expect(invoke).toHaveBeenCalledWith('pronounce', { body: { itemId: ITEM } });
    expect(source.url).toBe('https://x/a.mp3');
    expect(source.expiresAt).toBeGreaterThanOrEqual(before + 3_600_000);
  });

  it.each([
    ['daily-limit', 429, 'audio-limit'],
    ['monthly-limit', 429, 'audio-quota'],
    ['provider-quota', 503, 'audio-quota'],
    ['provider-busy', 503, 'audio-busy'],
    ['voice-unavailable', 503, 'audio-unavailable'],
    ['not-configured', 503, 'audio-unavailable'],
    ['item-not-found', 404, 'not-found'],
    ['unauthorized', 401, 'session'],
  ])('traduce el error "%s" de la función', async (code, status, kind) => {
    invoke.mockResolvedValue({ data: null, error: httpError(status, { error: code }) });
    await expect(repository.getAudio(ITEM)).rejects.toMatchObject({ kind });
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it('trata un 401 de la plataforma (JWT inválido) como sesión caducada', async () => {
    invoke.mockResolvedValue({
      data: null,
      error: httpError(401, { code: 'UNAUTHORIZED_LEGACY_JWT', message: 'Invalid JWT' }),
    });
    await expect(repository.getAudio(ITEM)).rejects.toMatchObject({ kind: 'session' });
  });

  it('distingue los errores de red', async () => {
    invoke.mockResolvedValue({ data: null, error: new FunctionsFetchError(new TypeError('x')) });
    await expect(repository.getAudio(ITEM)).rejects.toMatchObject({ kind: 'network' });
  });

  it('si otra petición está generando el audio, espera y reintenta', async () => {
    vi.useFakeTimers();
    invoke
      .mockResolvedValueOnce({ data: null, error: httpError(409, { error: 'generating' }) })
      .mockResolvedValueOnce({ data: { url: 'https://x/a.mp3', expiresIn: 3600 }, error: null });

    const result = repository.getAudio(ITEM);
    await vi.advanceTimersByTimeAsync(GENERATING_RETRY_DELAY_MS);

    await expect(result).resolves.toMatchObject({ url: 'https://x/a.mp3' });
    expect(invoke).toHaveBeenCalledTimes(2);
  });

  it('no reintenta indefinidamente: tras dos esperas informa que el audio se está preparando', async () => {
    vi.useFakeTimers();
    invoke.mockResolvedValue({ data: null, error: httpError(409, { error: 'generating' }) });

    const result = repository.getAudio(ITEM);
    const assertion = expect(result).rejects.toMatchObject({ kind: 'audio-busy' });
    await vi.advanceTimersByTimeAsync(GENERATING_RETRY_DELAY_MS * 2);

    await assertion;
    expect(invoke).toHaveBeenCalledTimes(3);
  });
});
