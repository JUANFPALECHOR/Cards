import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DIRECTION_LABELS } from '../../../../core/models/study-direction';
import { Icon, IconName } from '../../../../shared/ui/atoms/icon/icon';
import { AttemptGrade } from '../../../spaced-repetition/domain/learning-state';
import { RecentAttempt } from '../../data/progress.repository';

const GRADES: Record<AttemptGrade, { icon: IconName; label: string }> = {
  good: { icon: 'check', label: 'La sabía' },
  hard: { icon: 'wave', label: 'Me costó' },
  again: { icon: 'close', label: 'No la sabía' },
};

const relativeFormatter = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });

/** Últimas respuestas registradas: resultado (icono + texto), palabra, tipo de pregunta y cuándo. */
@Component({
  selector: 'app-recent-attempts',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  styleUrl: './recent-attempts.scss',
  template: `
    <ul class="attempts">
      @for (attempt of attempts(); track attempt.id) {
        <li class="attempt" [attr.data-grade]="attempt.grade">
          <span class="icon"><app-icon [name]="grades[attempt.grade].icon" [size]="16" /></span>
          <span class="main">
            <span class="term" lang="en">{{ attempt.term }}</span>
            <span class="meta">{{ metaOf(attempt) }}</span>
          </span>
          <span class="side">
            <span class="grade">{{ grades[attempt.grade].label }}</span>
            <span class="meta">{{ timeAgo(attempt.at) }}</span>
          </span>
        </li>
      }
    </ul>
  `,
})
export class RecentAttempts {
  readonly attempts = input.required<readonly RecentAttempt[]>();

  protected readonly grades = GRADES;

  protected metaOf(attempt: RecentAttempt): string {
    const kind =
      attempt.kind === 'multiple_choice'
        ? 'Selección múltiple'
        : attempt.kind === 'written'
          ? 'Respuesta escrita'
          : attempt.source === 'quiz'
            ? 'Cuestionario'
            : 'Flashcard';
    return `${kind} · ${DIRECTION_LABELS[attempt.direction]}`;
  }

  protected timeAgo(date: Date): string {
    const minutes = Math.round((date.getTime() - Date.now()) / 60_000);
    if (Math.abs(minutes) < 1) return 'ahora';
    if (Math.abs(minutes) < 60) return relativeFormatter.format(minutes, 'minute');
    const hours = Math.round(minutes / 60);
    if (Math.abs(hours) < 24) return relativeFormatter.format(hours, 'hour');
    return relativeFormatter.format(Math.round(hours / 24), 'day');
  }
}
