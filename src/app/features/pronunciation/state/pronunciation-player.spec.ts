import { TestBed } from '@angular/core/testing';
import { AuthService } from '../../../core/auth/auth.service';
import { ToastService } from '../../../core/feedback/toast.service';
import { AppError } from '../../../core/supabase/app-error';
import { createAuthStub } from '../../../../testing/auth-stub';
import { PronunciationRepository } from '../data/pronunciation.repository';
import { AUDIO_ELEMENT_FACTORY, PronunciationPlayer } from './pronunciation-player';

class FakeAudio {
  src = '';
  currentTime = 0;
  playbackRate = 1;
  defaultPlaybackRate = 1;
  preload = '';
  play = vi.fn().mockResolvedValue(undefined);
  pause = vi.fn();
  private readonly listeners = new Map<string, () => void>();
  addEventListener(type: string, listener: () => void): void {
    this.listeners.set(type, listener);
  }
  emit(type: string): void {
    this.listeners.get(type)?.();
  }
}

const ITEM = '6704e229-8e15-40a3-9395-6046b31480f0';
const URL_A = 'https://storage.example/a.mp3';

describe('PronunciationPlayer', () => {
  let audio: FakeAudio;
  let repository: { getAudio: ReturnType<typeof vi.fn> };
  let toasts: { error: ReturnType<typeof vi.fn>; info: ReturnType<typeof vi.fn> };
  let auth: ReturnType<typeof createAuthStub>;
  let player: PronunciationPlayer;

  const source = (url = URL_A, ttlMs = 3_600_000) => ({ url, expiresAt: Date.now() + ttlMs });

  beforeEach(() => {
    audio = new FakeAudio();
    repository = { getAudio: vi.fn().mockResolvedValue(source()) };
    toasts = { error: vi.fn(), info: vi.fn() };
    auth = createAuthStub('user-1');
    TestBed.configureTestingModule({
      providers: [
        { provide: PronunciationRepository, useValue: repository },
        { provide: ToastService, useValue: toasts },
        { provide: AuthService, useValue: auth },
        { provide: AUDIO_ELEMENT_FACTORY, useValue: () => audio as unknown as HTMLAudioElement },
      ],
    });
    player = TestBed.inject(PronunciationPlayer);
    TestBed.tick();
  });

  it('reproduce a velocidad normal y marca el estado como "playing"', async () => {
    await player.toggle(ITEM, 'Troubleshooting', 1);

    expect(repository.getAudio).toHaveBeenCalledWith(ITEM);
    expect(audio.src).toBe(URL_A);
    expect(audio.playbackRate).toBe(1);
    expect(player.state()).toEqual(expect.objectContaining({ rate: 1, phase: 'playing' }));
  });

  it('la velocidad lenta reutiliza el mismo archivo con playbackRate 0,75', async () => {
    await player.toggle(ITEM, 'Troubleshooting', 1);
    audio.emit('ended');
    audio.currentTime = 0.8;

    await player.toggle(ITEM, 'Troubleshooting', 0.75);

    expect(repository.getAudio).toHaveBeenCalledTimes(1);
    expect(audio.src).toBe(URL_A);
    expect(audio.currentTime).toBe(0);
    expect(audio.playbackRate).toBe(0.75);
    expect(audio.defaultPlaybackRate).toBe(0.75);
  });

  it('pulsar de nuevo detiene, y repetir no vuelve a llamar al servidor', async () => {
    await player.toggle(ITEM, 'Troubleshooting', 1);
    await player.toggle(ITEM, 'Troubleshooting', 1);

    expect(audio.pause).toHaveBeenCalled();
    expect(player.state()).toBeNull();

    await player.toggle(ITEM, 'Troubleshooting', 1);
    expect(audio.play).toHaveBeenCalledTimes(2);
    expect(repository.getAudio).toHaveBeenCalledTimes(1);
  });

  it('al terminar el audio vuelve al estado de reposo', async () => {
    await player.toggle(ITEM, 'Troubleshooting', 1);
    audio.emit('ended');
    expect(player.state()).toBeNull();
  });

  it('si se edita la palabra no reutiliza el audio de la versión anterior', async () => {
    await player.toggle(ITEM, 'Troubleshooting', 1);
    repository.getAudio.mockResolvedValue(source('https://storage.example/b.mp3'));

    await player.toggle(ITEM, 'Troubleshoot', 1);

    expect(repository.getAudio).toHaveBeenCalledTimes(2);
    expect(audio.src).toBe('https://storage.example/b.mp3');
  });

  it('comparte una sola petición si se pulsa varias veces mientras carga', async () => {
    let resolve!: (value: unknown) => void;
    repository.getAudio.mockReturnValue(new Promise((r) => (resolve = r)));

    const first = player.toggle(ITEM, 'Troubleshooting', 1);
    const second = player.toggle(ITEM, 'Troubleshooting', 0.75);
    expect(player.state()).toEqual(expect.objectContaining({ rate: 0.75, phase: 'loading' }));
    resolve(source());
    await Promise.all([first, second]);

    expect(repository.getAudio).toHaveBeenCalledTimes(1);
    expect(audio.play).toHaveBeenCalledTimes(1);
    expect(player.state()).toEqual(expect.objectContaining({ rate: 0.75, phase: 'playing' }));
  });

  it('vuelve a pedir la URL si está a punto de caducar', async () => {
    repository.getAudio.mockResolvedValue(source(URL_A, 30_000));
    await player.toggle(ITEM, 'Troubleshooting', 1);
    audio.emit('ended');
    await player.toggle(ITEM, 'Troubleshooting', 1);
    expect(repository.getAudio).toHaveBeenCalledTimes(2);
  });

  it('muestra un mensaje claro si el audio no está disponible', async () => {
    repository.getAudio.mockRejectedValue(new AppError('audio-limit'));

    await player.toggle(ITEM, 'Troubleshooting', 1);

    expect(toasts.error).toHaveBeenCalledWith(new AppError('audio-limit').message);
    expect(player.state()).toBeNull();
  });

  it('si el navegador bloquea la reproducción, pide tocar de nuevo sin volver a pedir el audio', async () => {
    audio.play.mockRejectedValueOnce(
      Object.assign(new Error('blocked'), { name: 'NotAllowedError' }),
    );

    await player.toggle(ITEM, 'Troubleshooting', 1);
    expect(toasts.info).toHaveBeenCalled();
    expect(player.state()).toBeNull();

    await player.toggle(ITEM, 'Troubleshooting', 1);
    expect(repository.getAudio).toHaveBeenCalledTimes(1);
    expect(player.state()).toEqual(expect.objectContaining({ phase: 'playing' }));
  });

  it('al cambiar de usuario detiene el audio y olvida las URL', async () => {
    await player.toggle(ITEM, 'Troubleshooting', 1);

    auth.userId.set('user-2');
    TestBed.tick();

    expect(player.state()).toBeNull();
    await player.toggle(ITEM, 'Troubleshooting', 1);
    expect(repository.getAudio).toHaveBeenCalledTimes(2);
  });
});
