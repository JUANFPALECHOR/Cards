import {
  DOCUMENT,
  Injectable,
  InjectionToken,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';

export type Theme = 'light' | 'dark';

/** Debe coincidir con el script inline de index.html. */
export const THEME_STORAGE_KEY = 'el-theme';

const BROWSER_BAR_COLOR: Record<Theme, string> = {
  light: '#f6f6fb',
  dark: '#101120',
};

/** Almacenamiento de la preferencia. Inyectable para poder sustituirlo en pruebas. */
export const THEME_STORAGE = new InjectionToken<Storage | null>('THEME_STORAGE', {
  providedIn: 'root',
  factory: () => getStorage(inject(DOCUMENT)),
});

/**
 * Tema claro/oscuro. Sin preferencia guardada sigue al sistema operativo;
 * en cuanto el usuario elige uno, se persiste en localStorage.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly storage = inject(THEME_STORAGE);
  private readonly darkQuery = this.document.defaultView?.matchMedia?.(
    '(prefers-color-scheme: dark)',
  );

  private readonly preference = signal<Theme | null>(readPreference(this.storage));
  private readonly systemPrefersDark = signal(this.darkQuery?.matches ?? false);

  readonly theme = computed<Theme>(
    () => this.preference() ?? (this.systemPrefersDark() ? 'dark' : 'light'),
  );

  constructor() {
    // Servicio raíz: vive lo mismo que la aplicación, no requiere limpieza del listener.
    this.darkQuery?.addEventListener('change', (event) =>
      this.systemPrefersDark.set(event.matches),
    );
    effect(() => this.apply(this.theme()));
  }

  toggle(): void {
    this.setTheme(this.theme() === 'dark' ? 'light' : 'dark');
  }

  setTheme(theme: Theme): void {
    this.preference.set(theme);
    try {
      this.storage?.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Almacenamiento no disponible (p. ej. modo privado): el tema solo dura la sesión.
    }
  }

  private apply(theme: Theme): void {
    this.document.documentElement.setAttribute('data-theme', theme);
    this.document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', BROWSER_BAR_COLOR[theme]);
  }
}

function getStorage(document: Document): Storage | null {
  try {
    return document.defaultView?.localStorage ?? null;
  } catch {
    return null;
  }
}

function readPreference(storage: Storage | null): Theme | null {
  try {
    const value = storage?.getItem(THEME_STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}
