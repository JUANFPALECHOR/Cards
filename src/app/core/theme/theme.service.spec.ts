import { TestBed } from '@angular/core/testing';
import { MemoryStorage } from '../../../testing/memory-storage';
import { THEME_STORAGE, THEME_STORAGE_KEY, ThemeService } from './theme.service';

describe('ThemeService', () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
    TestBed.configureTestingModule({ providers: [{ provide: THEME_STORAGE, useValue: storage }] });
    document.documentElement.removeAttribute('data-theme');
  });

  it('usa el tema claro cuando no hay preferencia guardada ni preferencia oscura del sistema', () => {
    const service = TestBed.inject(ThemeService);
    TestBed.tick();

    expect(service.theme()).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('respeta la preferencia guardada', () => {
    storage.setItem(THEME_STORAGE_KEY, 'dark');
    const service = TestBed.inject(ThemeService);
    TestBed.tick();

    expect(service.theme()).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('ignora valores guardados no válidos', () => {
    storage.setItem(THEME_STORAGE_KEY, 'sepia');
    const service = TestBed.inject(ThemeService);

    expect(service.theme()).toBe('light');
  });

  it('alterna el tema, lo aplica al documento y lo persiste', () => {
    const service = TestBed.inject(ThemeService);

    service.toggle();
    TestBed.tick();

    expect(service.theme()).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(storage.getItem(THEME_STORAGE_KEY)).toBe('dark');

    service.toggle();
    TestBed.tick();

    expect(service.theme()).toBe('light');
    expect(storage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });

  it('actualiza el color de la barra del navegador', () => {
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.appendChild(meta);

    const service = TestBed.inject(ThemeService);
    service.setTheme('dark');
    TestBed.tick();

    expect(meta.getAttribute('content')).toBe('#101120');
    meta.remove();
  });
});
