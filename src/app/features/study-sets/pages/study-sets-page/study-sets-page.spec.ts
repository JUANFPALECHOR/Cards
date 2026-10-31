import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { VocabularyRepository } from '../../../vocabulary/data/vocabulary.repository';
import { StudySet } from '../../models/study-set';
import { StudySetsStore } from '../../state/study-sets.store';
import { StudySetsPage } from './study-sets-page';

describe('StudySetsPage: búsqueda y filtros', () => {
  const samples: StudySet[] = [
    {
      id: 'a',
      name: 'Redes',
      description: 'Inglés técnico',
      wordCount: 2,
      createdAt: '2026-10-28',
      updatedAt: '2026-10-28',
    },
    {
      id: 'b',
      name: 'Aeropuerto',
      description: null,
      wordCount: 0,
      createdAt: '2026-10-30',
      updatedAt: '2026-10-30',
    },
    {
      id: 'c',
      name: 'Viajes',
      description: 'Expresiones útiles',
      wordCount: 3,
      createdAt: '2026-10-29',
      updatedAt: '2026-10-29',
    },
  ];
  const sets = signal<readonly StudySet[]>(samples);

  beforeEach(() => {
    sets.set(samples);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: StudySetsStore,
          useValue: { sets, status: signal('ready'), error: signal(null), load: vi.fn() },
        },
        { provide: VocabularyRepository, useValue: { listBySet: vi.fn().mockResolvedValue([]) } },
      ],
    });
  });

  async function render() {
    const fixture = TestBed.createComponent(StudySetsPage);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const names = () =>
      [...element.querySelectorAll('app-study-set-card .title')].map((title) =>
        title.textContent?.trim(),
      );
    const select = async (label: string, value: string) => {
      const field = [...element.querySelectorAll('label')]
        .find((item) => item.textContent?.includes(label))!
        .querySelector('select')!;
      field.value = value;
      field.dispatchEvent(new Event('change'));
      await fixture.whenStable();
    };
    return { fixture, element, names, select };
  }

  it('ordena por fecha o nombre sin modificar los datos compartidos', async () => {
    const { names, select } = await render();
    expect(names()).toEqual(['Aeropuerto', 'Viajes', 'Redes']);
    await select('Ordenar conjuntos', 'oldest');
    expect(names()).toEqual(['Redes', 'Viajes', 'Aeropuerto']);
    await select('Ordenar conjuntos', 'name');
    expect(names()).toEqual(['Aeropuerto', 'Redes', 'Viajes']);
    expect(sets()).toEqual(samples);
    expect(sets()[0].id).toBe('a');
  });

  it('combina búsqueda y cantidad de palabras, y permite limpiar un resultado vacío', async () => {
    const { fixture, element, names, select } = await render();
    await select('Filtrar conjuntos', 'with-words');
    expect(names()).toEqual(['Viajes', 'Redes']);
    const search = element.querySelector('input[type="search"]') as HTMLInputElement;
    search.value = 'ingles tecnico';
    search.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(names()).toEqual(['Redes']);
    await select('Filtrar conjuntos', 'empty');
    expect(names()).toEqual([]);
    const clear = [...element.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('Limpiar filtros'),
    )!;
    clear.click();
    await fixture.whenStable();
    expect(names()).toHaveLength(3);
    expect(search.value).toBe('');
  });

  it('conserva los destinos de detalle, flashcards y cuestionario y el diálogo de creación', async () => {
    const { fixture, element } = await render();
    expect(element.querySelector('a[href="/sets/a"]')).not.toBeNull();
    expect(element.querySelector('a[href="/sets/a/flashcards"]')).not.toBeNull();
    expect(element.querySelector('a[href="/sets/a/quiz"]')).not.toBeNull();
    const dialog = element.querySelector('dialog')!;
    dialog.showModal = vi.fn(); // jsdom no implementa la apertura modal del navegador.
    (element.querySelector('.create-button') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(dialog.showModal).toHaveBeenCalledOnce();
  });
});
