import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { THEME_STORAGE } from '../../../../core/theme/theme.service';
import { MemoryStorage } from '../../../../../testing/memory-storage';
import { Topbar } from './topbar';

describe('Topbar', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: THEME_STORAGE, useValue: new MemoryStorage() }],
    });
  });

  it('muestra la marca, la navegación principal y el selector de tema', () => {
    const fixture = TestBed.createComponent(Topbar);
    fixture.componentRef.setInput('items', [
      { label: 'Conjuntos', path: '/sets', icon: 'stack' },
      { label: 'Progreso', path: '/progress', icon: 'chart' },
    ]);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('.brand')?.textContent).toContain('English Learning');

    const links = Array.from(element.querySelectorAll<HTMLAnchorElement>('nav a'));
    expect(links.map((link) => link.textContent?.trim())).toEqual(['Conjuntos', 'Progreso']);
    expect(links[0].getAttribute('href')).toBe('/sets');

    expect(element.querySelector('app-theme-toggle button')?.getAttribute('aria-label')).toBe(
      'Cambiar a modo oscuro',
    );
  });

  it('sin sesión no muestra navegación ni botón de salida', () => {
    const fixture = TestBed.createComponent(Topbar);
    fixture.componentRef.setInput('items', []);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelectorAll('nav a')).toHaveLength(0);
    expect(element.querySelector('button[aria-label="Cerrar sesión"]')).toBeNull();
  });

  it('con sesión muestra el correo y emite la petición de cerrar sesión', () => {
    const fixture = TestBed.createComponent(Topbar);
    fixture.componentRef.setInput('items', []);
    fixture.componentRef.setInput('email', 'ana@correo.com');
    const requested = vi.fn();
    fixture.componentInstance.signOutRequested.subscribe(requested);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('.account')?.textContent).toContain('ana@correo.com');
    element.querySelector<HTMLButtonElement>('button[aria-label="Cerrar sesión"]')?.click();
    expect(requested).toHaveBeenCalledTimes(1);
  });
});
