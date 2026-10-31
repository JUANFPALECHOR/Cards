import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { VocabularyRepository } from '../../../vocabulary/data/vocabulary.repository';
import { StudySetCard } from './study-set-card';

describe('StudySetCard: progreso real', () => {
  const listBySet = vi.fn();
  const sample = {
    id: 'set-1',
    name: 'Redes',
    description: null,
    wordCount: 3,
    createdAt: '2026-10-30',
    updatedAt: '2026-10-30',
  };

  beforeEach(() => {
    listBySet.mockReset();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: VocabularyRepository, useValue: { listBySet } }],
    });
  });

  it('13 · 14 · reparte cada palabra en un único estado y la barra suma el total', async () => {
    listBySet.mockResolvedValue([
      { status: 'new' },
      { status: 'learning' },
      { status: 'difficult' },
      { status: 'provisional' },
      { status: 'learned' },
      { status: 'learned' },
    ]);
    const fixture = TestBed.createComponent(StudySetCard);
    fixture.componentRef.setInput('set', { ...sample, wordCount: 6 });
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const bar = element.querySelector('[role="img"]')!;

    expect(element.textContent).toContain('2 / 6 aprendidas');
    expect(bar.getAttribute('aria-label')).toBe(
      'Estado de las 6 palabras de Redes. Aprendida: 2, Dominada provisionalmente: 1, En aprendizaje: 1, Difícil: 1, Nueva: 1.',
    );
    const widths = [...element.querySelectorAll<HTMLElement>('.segment')].map((s) =>
      Number(s.style.flexGrow),
    );
    expect(widths).toEqual([2, 1, 1, 1, 1]);
    expect(widths.reduce((a, b) => a + b, 0)).toBe(6);
    expect(listBySet).toHaveBeenCalledWith('set-1');
  });

  it('no representa un error de lectura como progreso cero y permite reintentar', async () => {
    listBySet
      .mockRejectedValueOnce(new Error('Sin conexión'))
      .mockResolvedValueOnce([{ status: 'learned' }]);
    const fixture = TestBed.createComponent(StudySetCard);
    fixture.componentRef.setInput('set', sample);
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('No disponible');
    expect(fixture.nativeElement.querySelector('[role="img"]')).toBeNull();
    fixture.nativeElement.querySelector('.retry-progress').click();
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('1 / 1 aprendidas');
  });

  it('no consulta vocabulario ni ofrece sesiones para conjuntos vacíos', async () => {
    const fixture = TestBed.createComponent(StudySetCard);
    fixture.componentRef.setInput('set', { ...sample, wordCount: 0 });
    await fixture.whenStable();
    expect(listBySet).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Agrega palabras');
    expect(fixture.nativeElement.querySelector('a[href$="/flashcards"]')).toBeNull();
  });
});
