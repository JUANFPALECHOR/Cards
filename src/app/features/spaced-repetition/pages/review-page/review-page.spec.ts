import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { LearningOverview, LearningRepository, QueueEntry } from '../../data/learning.repository';
import { DEFAULT_LEARNING_CONFIG } from '../../domain/learning-config';
import { LearningState, applyAttempt } from '../../domain/learning-state';
import { LearningRecorder } from '../../state/learning-recorder';
import { ReviewPage } from './review-page';

const OVERVIEW: LearningOverview = {
  counts: { new: 1, learning: 1, difficult: 1, provisional: 0, learned: 0 },
  totalItems: 3,
  dueNow: 2,
  dueToday: 2,
  dueTomorrow: 0,
  dueWeek: 2,
  nextDueAt: null,
  totalAnswers: 5,
  correctAnswers: 2,
  hardAnswers: 0,
  masteredToday: 0,
  learnedToday: 0,
};

function state(status: LearningState['status'], failures: number): LearningState {
  const base = applyAttempt(
    null,
    { grade: 'again', kind: 'written', direction: 'en_es', at: new Date(2026, 9, 1) },
    DEFAULT_LEARNING_CONFIG,
  ).state;
  return { ...base, status, failures, difficulty: status === 'difficult' ? 60 : 20 };
}

function entry(itemId: string, term: string, value: LearningState | null): QueueEntry {
  return {
    itemId,
    setId: 'set-1',
    setName: 'Redes',
    term,
    translation: term,
    example: null,
    pronunciation: null,
    state: value,
  };
}

describe('ReviewPage', () => {
  const getOverview = vi.fn();
  const getQueue = vi.fn();
  const record = vi.fn();

  beforeEach(() => {
    getOverview.mockReset().mockResolvedValue(OVERVIEW);
    getQueue
      .mockReset()
      .mockImplementation(async (mode: string) =>
        mode === 'smart'
          ? [
              entry('l', 'learning-word', state('learning', 1)),
              entry('d', 'difficult-word', state('difficult', 3)),
              entry('n', 'new-word', null),
            ]
          : mode === 'difficult'
            ? [entry('d', 'difficult-word', state('difficult', 3))]
            : [],
      );
    record.mockReset();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: LearningRepository, useValue: { getOverview, getQueue } },
        { provide: LearningRecorder, useValue: { record, remember: vi.fn() } },
      ],
    });
  });

  async function render(mode?: string) {
    const fixture = TestBed.createComponent(ReviewPage);
    if (mode) fixture.componentRef.setInput('mode', mode);
    await fixture.whenStable();
    // La carga empieza en un effect (cuando ya se conoce el modo de la URL): esperar a que termine.
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
    return { fixture, element: fixture.nativeElement as HTMLElement };
  }

  it('muestra el selector de modo y los contadores de pendientes, difíciles y dominadas', async () => {
    const { element } = await render();
    const labels = [
      ...element.querySelectorAll('.setup > app-segmented-control .option-label'),
    ].map((label) => label.textContent?.trim());

    expect(labels).toEqual(['Repaso inteligente', 'Mis dificultades', 'Aprendidas']);
    expect(element.textContent).toContain('Pendientes');
    expect(element.textContent).toContain('Difíciles');
    expect(element.textContent).toContain('Dominadas');
    expect(element.textContent).toContain('3 tarjetas por orden de prioridad');
    expect(getQueue).toHaveBeenCalledWith('smart', 20);
  });

  it('?mode=difficult abre «Mis dificultades»', async () => {
    const { element } = await render('difficult');

    expect(getQueue).toHaveBeenCalledWith('difficult', 20);
    expect(element.textContent).toContain('1 tarjeta por orden de prioridad');
    expect(element.textContent).toContain('Solo las palabras que más te cuestan');
  });

  it('los accesos de los contadores cambian al modo correspondiente con su cola real', async () => {
    const { fixture, element } = await render();
    element.querySelector<HTMLButtonElement>('[aria-label="Repasar mis dificultades"]')!.click();
    await fixture.whenStable();

    expect(getQueue).toHaveBeenLastCalledWith('difficult', 20);
    expect(element.textContent).toContain('1 tarjeta por orden de prioridad');
    expect(element.querySelector<HTMLInputElement>('input[value="difficult"]')!.checked).toBe(true);

    element.querySelector<HTMLButtonElement>('[aria-label="Ver repaso inteligente"]')!.click();
    await fixture.whenStable();
    expect(getQueue).toHaveBeenLastCalledWith('smart', 20);
    expect(element.textContent).toContain('3 tarjetas por orden de prioridad');
    expect(element.querySelector('a.stat-action')?.getAttribute('href')).toBe('/progress');
  });

  it('los consejos se navegan manualmente sin cambiar el modo de repaso', async () => {
    const { fixture, element } = await render();
    const previous = element.querySelector<HTMLButtonElement>('[aria-label="Consejo anterior"]')!;
    const next = element.querySelector<HTMLButtonElement>('[aria-label="Consejo siguiente"]')!;
    expect(previous.disabled).toBe(true);
    expect(element.querySelector('.featured-tip h3')?.textContent).toBe('Sé constante');

    next.click();
    await fixture.whenStable();
    expect(element.querySelector('.featured-tip h3')?.textContent).toBe('Enfócate en lo difícil');
    next.click();
    await fixture.whenStable();
    expect(next.disabled).toBe(true);
    expect(element.querySelector('.counter')?.textContent?.trim()).toBe('3 / 3');

    element.querySelector<HTMLButtonElement>('.tip-pages button')!.click();
    await fixture.whenStable();
    expect(previous.disabled).toBe(true);
    expect(element.querySelector<HTMLInputElement>('input[value="smart"]')!.checked).toBe(true);
    expect(getQueue).toHaveBeenCalledTimes(1);
  });

  it('15 · sin palabras aprendidas explica cómo se consiguen', async () => {
    const { element } = await render('learned');
    expect(element.textContent).toContain('Aún no tienes palabras aprendidas');
  });

  it('las respuestas de Repasar se registran como autoevaluación en modo srs', async () => {
    record.mockResolvedValue({
      state: state('learning', 1),
      previousStatus: 'difficult',
      evidence: 'independent',
    });
    const { fixture, element } = await render('difficult');
    const click = async (text: string) => {
      [...element.querySelectorAll('button')].find((b) => b.textContent?.includes(text))!.click();
      await fixture.whenStable();
    };

    await click('Empezar');
    expect(element.querySelector('app-review-companion')).toBeNull();
    await click('Mostrar respuesta');
    await click('Me costó');

    expect(record).toHaveBeenCalledWith({
      itemId: 'd',
      grade: 'hard',
      kind: 'self_assessment',
      direction: 'en_es',
      source: 'flashcard',
      mode: 'srs',
    });
  });
});
