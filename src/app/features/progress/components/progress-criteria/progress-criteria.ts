import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Icon } from '../../../../shared/ui/atoms/icon/icon';
import { LEARNING_CONFIG } from '../../../spaced-repetition/srs-algorithm';

/** «¿Cómo se calcula?»: estados, criterios e indicadores, con los umbrales reales de la configuración. */
@Component({
  selector: 'app-progress-criteria',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  styleUrl: './progress-criteria.scss',
  template: `
    <details class="criteria">
      <summary>
        <span class="criteria-icon"><app-icon name="info" [size]="20" /></span>
        <span class="criteria-title">¿Cómo se calcula?</span>
        <app-icon class="criteria-chevron" name="chevron-down" [size]="20" />
      </summary>

      <div class="criteria-body">
        <h3 class="criteria-subtitle">El camino de cada palabra</h3>
        <ol class="path">
          <li style="--step-color: var(--color-status-new)">
            <strong>Nueva</strong>
            <span>Aún no la has respondido en flashcards, cuestionarios ni repasos.</span>
          </li>
          <li style="--step-color: var(--color-status-learning)">
            <strong>En aprendizaje</strong>
            <span>La has practicado, pero aún no demuestra suficiente dominio.</span>
          </li>
          <li style="--step-color: var(--color-status-provisional)">
            <strong>Dominada provisionalmente</strong>
            <span>
              La aciertas varias veces seguidas, separadas por al menos
              {{ config.immediateWindowMinutes }} minutos y a lo largo de
              {{ config.provisional.minSpanMinutes / 60 }} horas. Se consigue en un solo día;
              repetir al instante no cuenta.
            </span>
          </li>
          <li style="--step-color: var(--color-status-learned)">
            <strong>Aprendida</strong>
            <span>
              Además, la recuerdas sin fallar tras {{ config.learned.retentionGapHours }} horas sin
              verla, durante {{ config.learned.minSpanDays }} días o más. Sigue apareciendo en
              repasos cada vez más espaciados.
            </span>
          </li>
        </ol>
        <p class="difficult-note">
          <span class="dot" style="background: var(--color-status-difficult)"></span>
          <span>
            <strong>Difícil:</strong> la fallas a menudo, la olvidaste después de dominarla o te
            cuesta en una dirección. Deja de serlo cuando la aciertas de forma constante. Un fallo
            devuelve cualquier palabra a aprendizaje.
          </span>
        </p>

        <h3 class="criteria-subtitle">Tus indicadores</h3>
        <dl class="metrics">
          <div>
            <dt><app-icon name="target" [size]="18" /> Precisión</dt>
            <dd>
              Aciertos sobre todas tus respuestas; «Me costó» cuenta como acierto. Mide respuestas,
              no palabras.
            </dd>
          </div>
          <div>
            <dt><app-icon name="quiz" [size]="18" /> Tipo de pregunta</dt>
            <dd>
              Escribir la traducción pesa más que elegirla entre opciones. «Me costó» suma la mitad
              que «La sabía».
            </dd>
          </div>
          <div>
            <dt><app-icon name="flame" [size]="18" /> Racha</dt>
            <dd>
              Días seguidos con al menos una respuesta. La racha de ayer se conserva hasta la
              medianoche.
            </dd>
          </div>
        </dl>
      </div>
    </details>
  `,
})
export class ProgressCriteria {
  protected readonly config = inject(LEARNING_CONFIG);
}
