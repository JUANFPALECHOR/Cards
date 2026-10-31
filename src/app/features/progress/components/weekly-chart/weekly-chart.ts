import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { toPercent } from '../../../../shared/utils/numbers';
import { pluralize } from '../../../../shared/utils/text';
import { WeeklyPoint } from '../../data/progress.repository';

const weekFormatter = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' });

/**
 * Evolución semanal: columnas finas (≤ 24 px, extremo redondeado de 4 px) con las respuestas de cada
 * semana; la actual en color pleno y las anteriores atenuadas. Serie única, sin leyenda; el detalle está en la descripción emergente y en una tabla para
 * lectores de pantalla.
 */
@Component({
  selector: 'app-weekly-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './weekly-chart.scss',
  template: `
    @if (thisWeek(); as week) {
      <p class="lead">{{ lead() }}</p>
    }
    <div class="chart" aria-hidden="true">
      @for (week of weeks(); track week.weekStart) {
        <div class="col">
          <div class="plot">
            <span
              class="bar"
              [class.is-current]="week.current"
              [style.height.%]="week.height"
            ></span>
            <span class="tip">{{ week.tip }}</span>
          </div>
          <span class="label" [class.is-current]="week.current">{{ week.shortLabel }}</span>
        </div>
      }
    </div>
    <table class="sr-only">
      <caption>
        Respuestas por semana
      </caption>
      <thead>
        <tr>
          <th scope="col">Semana</th>
          <th scope="col">Respuestas</th>
          <th scope="col">Aciertos</th>
          <th scope="col">Palabras dominadas</th>
          <th scope="col">Palabras aprendidas</th>
        </tr>
      </thead>
      <tbody>
        @for (week of weeks(); track week.weekStart) {
          <tr>
            <th scope="row">{{ week.label }}</th>
            <td>{{ week.answers }}</td>
            <td>{{ week.correct }}</td>
            <td>{{ week.mastered }}</td>
            <td>{{ week.learned }}</td>
          </tr>
        }
      </tbody>
    </table>
  `,
})
export class WeeklyChart {
  readonly points = input.required<readonly WeeklyPoint[]>();

  protected readonly weeks = computed(() => {
    const points = this.points();
    const max = Math.max(1, ...points.map((week) => week.answers));
    return points.map((week, index) => {
      const current = index === points.length - 1;
      const label = current
        ? 'Esta semana'
        : `Semana del ${weekFormatter.format(parseDay(week.weekStart))}`;
      const shortLabel = weekFormatter.format(parseDay(week.weekStart));
      const accuracy = week.answers > 0 ? toPercent(week.correct, week.answers) : null;
      return {
        ...week,
        current,
        label,
        shortLabel,
        accuracy,
        height: (week.answers / max) * 100,
        tip: [
          `${label}: ${pluralize(week.answers, 'respuesta', 'respuestas')}`,
          accuracy === null ? null : `${accuracy}% de aciertos`,
          `${week.mastered} dominadas`,
        ]
          .filter(Boolean)
          .join(' · '),
      };
    });
  });

  protected readonly thisWeek = computed(() => this.weeks().at(-1) ?? null);

  protected readonly lead = computed(() => {
    const week = this.thisWeek();
    if (!week) return '';
    const parts = [pluralize(week.answers, 'respuesta', 'respuestas')];
    if (week.accuracy !== null) parts.push(`${week.accuracy}% de aciertos`);
    parts.push(`${pluralize(week.mastered, 'palabra dominada', 'palabras dominadas')}`);
    return `Esta semana: ${parts.join(' · ')}.`;
  });
}

/** "2026-10-26" → fecha local (sin desfase de zona horaria). */
function parseDay(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}
