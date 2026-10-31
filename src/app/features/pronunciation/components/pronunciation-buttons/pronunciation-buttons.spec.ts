import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  PlaybackState,
  PronunciationPlayer,
  pronunciationKey,
} from '../../state/pronunciation-player';
import { PronunciationButtons } from './pronunciation-buttons';

const ITEM = '6704e229-8e15-40a3-9395-6046b31480f0';

describe('PronunciationButtons', () => {
  let state: ReturnType<typeof signal<PlaybackState | null>>;
  let player: {
    state: typeof state;
    toggle: ReturnType<typeof vi.fn>;
    stopIfCurrent: ReturnType<typeof vi.fn>;
  };

  function render() {
    const fixture = TestBed.createComponent(PronunciationButtons);
    fixture.componentRef.setInput('itemId', ITEM);
    fixture.componentRef.setInput('term', 'Troubleshooting');
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const [normal, slow] = Array.from(element.querySelectorAll('button'));
    return { fixture, element, normal, slow };
  }

  beforeEach(() => {
    state = signal<PlaybackState | null>(null);
    player = { state, toggle: vi.fn().mockResolvedValue(undefined), stopIfCurrent: vi.fn() };
    TestBed.configureTestingModule({
      providers: [{ provide: PronunciationPlayer, useValue: player }],
    });
  });

  it('ofrece velocidad normal y lenta con nombres accesibles', () => {
    const { element, normal, slow } = render();

    expect(element.getAttribute('role')).toBe('group');
    expect(element.getAttribute('aria-label')).toBe('Pronunciación de «Troubleshooting»');
    expect(normal.getAttribute('aria-label')).toBe('Escuchar «Troubleshooting»');
    expect(slow.getAttribute('aria-label')).toBe('Escuchar «Troubleshooting» a velocidad lenta');
    expect(slow.textContent).toContain('0,75×');
  });

  it('pide reproducir a 1× o a 0,75×', () => {
    const { normal, slow } = render();

    normal.click();
    slow.click();

    expect(player.toggle).toHaveBeenNthCalledWith(1, ITEM, 'Troubleshooting', 1);
    expect(player.toggle).toHaveBeenNthCalledWith(2, ITEM, 'Troubleshooting', 0.75);
  });

  it('indica la carga y permite detener la reproducción en curso', () => {
    const { fixture, normal, slow } = render();

    state.set({ key: pronunciationKey(ITEM, 'Troubleshooting'), rate: 0.75, phase: 'loading' });
    fixture.detectChanges();
    expect(slow.getAttribute('aria-busy')).toBe('true');
    expect(normal.getAttribute('aria-busy')).toBeNull();

    state.set({ key: pronunciationKey(ITEM, 'Troubleshooting'), rate: 0.75, phase: 'playing' });
    fixture.detectChanges();
    expect(slow.getAttribute('aria-label')).toBe('Detener «Troubleshooting»');
    expect(slow.classList).toContain('is-active');
    expect(normal.classList).not.toContain('is-active');
  });

  it('no se marca activo si suena otra palabra', () => {
    const { fixture, normal } = render();
    state.set({ key: pronunciationKey('otro', 'Firewall'), rate: 1, phase: 'playing' });
    fixture.detectChanges();
    expect(normal.getAttribute('aria-label')).toBe('Escuchar «Troubleshooting»');
  });

  it('al desaparecer detiene su propio audio', () => {
    const { fixture } = render();
    fixture.destroy();
    expect(player.stopIfCurrent).toHaveBeenCalledWith(ITEM, 'Troubleshooting');
  });
});
