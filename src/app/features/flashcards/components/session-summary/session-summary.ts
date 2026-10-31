import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Icon } from '../../../../shared/ui/atoms/icon/icon';
import { ProgressBar } from '../../../../shared/ui/molecules/progress-bar/progress-bar';
import { SessionSummary as Summary } from '../../domain/study-session';

/** Resultado al terminar una sesión. «Me costó» cuenta como acierto. Las acciones se proyectan. */
@Component({
  selector: 'app-session-summary',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, ProgressBar],
  styleUrl: './session-summary.scss',
  template: `
    <span class="icon"><app-icon name="check" [size]="28" /></span>
    <h2 class="title">{{ title() }}</h2>
    <p class="percent">
      <strong>{{ summary().percent }}%</strong> de aciertos
    </p>
    <app-progress-bar
      class="bar"
      tone="success"
      [value]="summary().good + summary().hard"
      [max]="summary().total || 1"
      label="Porcentaje de aciertos"
    />
    <dl class="stats">
      <div class="stat">
        <dt>La sabía</dt>
        <dd class="good">{{ summary().good }}</dd>
      </div>
      <div class="stat">
        <dt>Me costó</dt>
        <dd class="hard">{{ summary().hard }}</dd>
      </div>
      <div class="stat">
        <dt>No la sabía</dt>
        <dd class="bad">{{ summary().again }}</dd>
      </div>
    </dl>
    <ng-content select="[summaryNote]" />
    <div class="actions"><ng-content /></div>
  `,
})
export class SessionSummary {
  readonly summary = input.required<Summary>();
  readonly title = input('¡Sesión completada!');
}
