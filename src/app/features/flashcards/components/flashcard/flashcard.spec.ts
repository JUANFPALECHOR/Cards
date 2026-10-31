import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PronunciationPlayer } from '../../../pronunciation/state/pronunciation-player';
import { Flashcard } from './flashcard';

const ITEM = '6704e229-8e15-40a3-9395-6046b31480f0';

describe('Flashcard: pronunciación y audio', () => {
  let fixture: ComponentFixture<Flashcard>;

  function render(direction: 'en_es' | 'es_en', options: { itemId?: string | null } = {}) {
    fixture = TestBed.createComponent(Flashcard);
    const en = direction === 'en_es';
    const ref = fixture.componentRef;
    ref.setInput('prompt', en ? 'Troubleshooting' : 'Diagnóstico de problemas');
    ref.setInput('answer', en ? 'Diagnóstico de problemas' : 'Troubleshooting');
    ref.setInput('promptLang', en ? 'en' : 'es');
    ref.setInput('answerLang', en ? 'es' : 'en');
    ref.setInput('promptLabel', en ? 'Inglés' : 'Español');
    ref.setInput('answerLabel', en ? 'Español' : 'Inglés');
    ref.setInput('itemId', options.itemId === undefined ? ITEM : options.itemId);
    ref.setInput('term', 'Troubleshooting');
    ref.setInput('pronunciation', 'TRÁ-bol-shú-ting');
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  function flip(): void {
    fixture.componentRef.setInput('flipped', true);
    fixture.detectChanges();
  }

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

  it('EN→ES: el audio y la pronunciación están disponibles desde el principio', () => {
    const element = render('en_es');
    expect(element.querySelector('app-pronunciation-buttons')).toBeTruthy();
    expect(element.querySelector('.front .pronunciation')?.textContent).toContain(
      'TRÁ-bol-shú-ting',
    );
    expect(element.querySelector('.back .pronunciation')).toBeNull();
  });

  it('ES→EN: no revela la respuesta antes de girar', () => {
    const element = render('es_en');
    expect(element.querySelector('app-pronunciation-buttons')).toBeNull();
    expect(element.querySelector('.front .pronunciation')).toBeNull();

    flip();

    expect(element.querySelector('app-pronunciation-buttons')).toBeTruthy();
    expect(element.querySelector('.back .pronunciation')?.textContent).toContain(
      'TRÁ-bol-shú-ting',
    );
  });

  it('el audio no está dentro del botón de la tarjeta y no la gira', () => {
    const element = render('en_es');
    const toggled = vi.fn();
    fixture.componentInstance.toggle.subscribe(toggled);

    expect(element.querySelector('.scene app-pronunciation-buttons')).toBeNull();
    element.querySelector<HTMLButtonElement>('app-pronunciation-buttons button')?.click();

    expect(toggled).not.toHaveBeenCalled();
  });

  it('sin palabra asociada (catálogo de diseño) no muestra botones', () => {
    const element = render('en_es', { itemId: null });
    expect(element.querySelector('app-pronunciation-buttons')).toBeNull();
  });
});
