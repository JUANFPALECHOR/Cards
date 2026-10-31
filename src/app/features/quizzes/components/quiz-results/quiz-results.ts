import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { languagesOf } from '../../../../core/models/study-direction';
import { ProgressBar } from '../../../../shared/ui/molecules/progress-bar/progress-bar';
import { QuizAnswer, QuizResult } from '../../models/quiz';

/** Resultado final: aciertos, errores, porcentaje y repaso de las respuestas a corregir. */
@Component({
  selector: 'app-quiz-results',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ProgressBar],
  styleUrl: './quiz-results.scss',
  template: `
    <section class="score" aria-labelledby="quiz-score-title">
      <h2 id="quiz-score-title" class="title">{{ headline() }}</h2>
      <p class="percent">
        <strong>{{ result().percent }}%</strong> de respuestas correctas
      </p>
      <app-progress-bar
        class="bar"
        tone="success"
        [value]="result().correct"
        [max]="result().total || 1"
        label="Porcentaje de respuestas correctas"
      />
      <dl class="stats">
        <div class="stat">
          <dt>Aciertos</dt>
          <dd class="good">{{ result().correct }}</dd>
        </div>
        <div class="stat">
          <dt>Errores</dt>
          <dd class="bad">{{ result().incorrect }}</dd>
        </div>
        <div class="stat">
          <dt>Preguntas</dt>
          <dd>{{ result().total }}</dd>
        </div>
      </dl>
      <div class="actions"><ng-content /></div>
    </section>

    @if (toReview().length > 0) {
      <section class="review" aria-labelledby="quiz-review-title">
        <h2 id="quiz-review-title" class="text-subheading">Para repasar</h2>
        <ul class="review-list">
          @for (answer of toReview(); track answer.question.index) {
            <li class="review-item" [attr.data-outcome]="answer.outcome">
              <p class="review-prompt" [attr.lang]="lang(answer).prompt">
                {{ answer.question.prompt }}
              </p>
              <p class="review-line">
                Tu respuesta:
                <span [attr.lang]="lang(answer).answer">{{ answer.given || '—' }}</span>
              </p>
              <p class="review-line">
                Correcta:
                <strong [attr.lang]="lang(answer).answer">{{
                  answer.matched ?? answer.question.answer
                }}</strong>
                @if (answer.outcome === 'correct-with-warning') {
                  <span class="tag">revisa las tildes</span>
                }
              </p>
            </li>
          }
        </ul>
      </section>
    }
  `,
})
export class QuizResults {
  readonly result = input.required<QuizResult>();
  readonly answers = input.required<readonly QuizAnswer[]>();

  protected readonly toReview = computed(() =>
    this.answers().filter((answer) => answer.outcome !== 'correct'),
  );

  protected readonly headline = computed(() => {
    const percent = this.result().percent;
    if (percent === 100) return '¡Perfecto!';
    if (percent >= 80) return '¡Muy bien!';
    if (percent >= 50) return 'Buen trabajo';
    return 'Sigue practicando';
  });

  protected lang(answer: QuizAnswer) {
    return languagesOf(answer.question.direction);
  }
}
