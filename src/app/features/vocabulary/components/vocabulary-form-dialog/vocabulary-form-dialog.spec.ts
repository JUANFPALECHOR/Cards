import { ComponentFixture, TestBed } from '@angular/core/testing';
import { VocabularyItem } from '../../models/vocabulary-item';
import { VocabularyFormDialog, VocabularySaveRequest } from './vocabulary-form-dialog';

const EXISTING: VocabularyItem = {
  id: '6704e229-8e15-40a3-9395-6046b31480f0',
  setId: 'set-1',
  term: 'Troubleshooting',
  translation: 'Diagnóstico y solución de problemas',
  example: null,
  notes: null,
  pronunciation: 'TRÁ-bol-shú-ting',
  status: 'new',
  learning: null,
  createdAt: '2026-10-30T00:00:00Z',
  updatedAt: '2026-10-30T00:00:00Z',
};

describe('VocabularyFormDialog: pronunciación', () => {
  let fixture: ComponentFixture<VocabularyFormDialog>;
  let saved: VocabularySaveRequest[];

  function render(item: VocabularyItem | null): HTMLElement {
    fixture = TestBed.createComponent(VocabularyFormDialog);
    saved = [];
    fixture.componentInstance.save.subscribe((request) => saved.push(request));
    fixture.componentRef.setInput('item', item);
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  function field(element: HTMLElement, label: string): HTMLInputElement {
    const container = Array.from(element.querySelectorAll('app-form-field')).find((node) =>
      node.querySelector('label')?.textContent?.includes(label),
    );
    return container!.querySelector('input, textarea') as HTMLInputElement;
  }

  function type(input: HTMLInputElement, value: string): void {
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  function submit(element: HTMLElement): void {
    element.querySelector('form')!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  }

  it('prioriza palabra y traducción y conserva los campos opcionales en Más detalles', () => {
    const element = render(null);
    const labels = Array.from(element.querySelectorAll('app-form-field label')).map((label) =>
      label.textContent?.replace('*', '').trim(),
    );
    expect(labels).toEqual([
      'Palabra o expresión en inglés',
      'Traducción al español',
      'Pronunciación aproximada (opcional)',
      'Oración de ejemplo',
      'Notas personales',
    ]);
    expect(field(element, 'Pronunciación').placeholder).toContain('TRÁ-bol-shú-ting');
    expect(element.querySelector('details')?.open).toBe(false);
  });

  it('guarda una palabra sin pronunciación como null', () => {
    const element = render(null);
    type(field(element, 'Palabra'), 'Device');
    type(field(element, 'Traducción'), 'Dispositivo');

    submit(element);

    expect(saved[0].input.pronunciation).toBeNull();
  });

  it('guarda la pronunciación escrita, recortando espacios sobrantes', () => {
    const element = render(null);
    type(field(element, 'Palabra'), 'Device');
    type(field(element, 'Pronunciación'), '  di-VÁIS   ');
    type(field(element, 'Traducción'), 'Dispositivo');

    submit(element);

    expect(saved[0].input).toEqual(
      expect.objectContaining({ term: 'Device', pronunciation: 'di-VÁIS' }),
    );
  });

  it('al editar carga la pronunciación existente y permite cambiarla', () => {
    const element = render(EXISTING);
    const input = field(element, 'Pronunciación');
    expect(element.querySelector('details')?.open).toBe(true);
    expect(input.value).toBe('TRÁ-bol-shú-ting');

    type(input, 'TRÁ-bol-shu-ting');
    submit(element);

    expect(saved[0].input.pronunciation).toBe('TRÁ-bol-shu-ting');
  });

  it('limita la longitud de la pronunciación', () => {
    const element = render(null);
    type(field(element, 'Palabra'), 'Device');
    type(field(element, 'Traducción'), 'Dispositivo');
    type(field(element, 'Pronunciación'), 'a'.repeat(101));

    submit(element);

    expect(saved).toHaveLength(0);
    expect(element.textContent).toContain('Máximo 100 caracteres.');
    expect(element.querySelector('details')?.open).toBe(true);
  });
});
