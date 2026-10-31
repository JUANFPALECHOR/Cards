import { TestBed } from '@angular/core/testing';
import { StudyCard } from '../../models/study-card';
import { CardAnswer, FlashcardSession } from './flashcard-session';
import { SessionSummary } from '../../domain/study-session';

const cards: StudyCard[] = [
  {
    id: '1',
    term: 'run',
    translation: 'correr',
    example: null,
    pronunciation: null,
    setName: null,
  },
  {
    id: '2',
    term: 'walk',
    translation: 'caminar',
    example: null,
    pronunciation: null,
    setName: null,
  },
];

describe('FlashcardSession', () => {
  async function setup() {
    const fixture = TestBed.createComponent(FlashcardSession);
    fixture.componentRef.setInput('cards', cards);
    fixture.componentRef.setInput('direction', 'en_es');
    const answered: CardAnswer[] = [];
    let summary: SessionSummary | null = null;
    fixture.componentInstance.answered.subscribe((answer) => answered.push(answer));
    fixture.componentInstance.finished.subscribe((result) => (summary = result));
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const click = async (text: string) => {
      const button = [...element.querySelectorAll('button')].find((b) =>
        b.textContent?.includes(text),
      );
      button!.click();
      await fixture.whenStable();
    };
    return { fixture, element, answered, click, summary: () => summary };
  }

  it('muestra la pregunta y revela la respuesta', async () => {
    const { element, click } = await setup();

    expect(element.querySelector('.front')?.textContent).toContain('run');
    expect(element.querySelector('.scene')?.classList).not.toContain('is-flipped');

    await click('Mostrar respuesta');

    expect(element.querySelector('.scene')?.classList).toContain('is-flipped');
    expect(element.querySelector('[aria-live]')?.textContent).toContain('correr');
  });

  it('emite las tres evaluaciones, repite solo las que no sabía y termina con el resumen', async () => {
    const { answered, click, summary, element } = await setup();

    await click('Mostrar respuesta');
    await click('No la sabía');
    await click('Mostrar respuesta');
    await click('Me costó');

    // La tarjeta fallada se repite una vez, pero no se vuelve a emitir.
    expect(element.textContent).toContain('Repetición de una fallada');
    await click('Mostrar respuesta');
    await click('La sabía');

    expect(answered.map((a) => [a.card.id, a.grade])).toEqual([
      ['1', 'again'],
      ['2', 'hard'],
    ]);
    expect(summary()).toEqual({ total: 2, good: 0, hard: 1, again: 1, percent: 50 });
  });

  it('girar la tarjeta no cuenta como acierto y el teclado usa 1, 2 y 3', async () => {
    const { answered, element, fixture } = await setup();
    const press = async (key: string) => {
      element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
      await fixture.whenStable();
    };

    await press(' ');
    expect(element.querySelector('.scene')?.classList).toContain('is-flipped');
    expect(answered).toHaveLength(0);

    await press('2');
    await press(' ');
    await press('3');
    expect(answered.map((a) => a.grade)).toEqual(['hard', 'good']);
  });

  it('no permite evaluar antes de girar la tarjeta', async () => {
    const { element } = await setup();
    const labels = [...element.querySelectorAll('button')].map((b) => b.textContent?.trim());
    expect(labels.some((label) => label?.includes('La sabía'))).toBe(false);
    expect(labels).toContain('Mostrar respuesta');
  });
});
