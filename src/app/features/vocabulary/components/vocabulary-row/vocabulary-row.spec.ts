import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PronunciationPlayer } from '../../../pronunciation/state/pronunciation-player';
import { VocabularyItem } from '../../models/vocabulary-item';
import { VocabularyRow } from './vocabulary-row';

function item(overrides: Partial<VocabularyItem> = {}): VocabularyItem {
  return {
    id: '6704e229-8e15-40a3-9395-6046b31480f0',
    setId: 'set-1',
    term: 'Troubleshooting',
    translation: 'Diagnóstico y solución de problemas',
    example: null,
    notes: null,
    pronunciation: null,
    status: 'new',
    learning: null,
    createdAt: '2026-10-30T00:00:00Z',
    updatedAt: '2026-10-30T00:00:00Z',
    ...overrides,
  };
}

describe('VocabularyRow', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: PronunciationPlayer,
          useValue: { state: signal(null), toggle: vi.fn(), stopIfCurrent: vi.fn() },
        },
      ],
    });
  });

  function render(value: VocabularyItem): HTMLElement {
    const fixture = TestBed.createComponent(VocabularyRow);
    fixture.componentRef.setInput('item', value);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('muestra la pronunciación debajo de la palabra y los botones de audio', () => {
    const element = render(item({ pronunciation: 'TRÁ-bol-shú-ting' }));

    const term = element.querySelector('.term');
    const pronunciation = element.querySelector('.pronunciation');
    expect(pronunciation?.textContent).toContain('TRÁ-bol-shú-ting');
    expect(pronunciation?.getAttribute('lang')).toBe('es');
    expect(
      term!.compareDocumentPosition(pronunciation!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(element.querySelector('[aria-label="Escuchar «Troubleshooting»"]')).toBeTruthy();
  });

  it('las palabras sin pronunciación se muestran igual que antes, con audio disponible', () => {
    const element = render(item());
    expect(element.querySelector('.pronunciation')).toBeNull();
    expect(element.querySelector('.translation')?.textContent).toContain('Diagnóstico');
    expect(element.querySelector('app-pronunciation-buttons')).toBeTruthy();
  });
});
