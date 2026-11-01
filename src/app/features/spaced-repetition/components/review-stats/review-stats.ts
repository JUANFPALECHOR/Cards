import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Icon, IconName } from '../../../../shared/ui/atoms/icon/icon';
import { LearningOverview } from '../../data/learning.repository';

/** Grupos de palabras que se pueden consultar desde Repasar. */
export type WordGroup = 'due' | 'difficult' | 'mastered';

interface StatItem {
  readonly group: WordGroup;
  readonly label: string;
  readonly value: number;
  readonly caption: string;
  readonly icon: IconName;
  readonly tone: 'warning' | 'danger' | 'success';
}

/** Pendientes · Difíciles · Dominadas. Cada tarjeta abre la lista de esas palabras. */
@Component({
  selector: 'app-review-stats',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  styleUrl: './review-stats.scss',
  template: `
    @for (item of items(); track item.group) {
      <button
        type="button"
        class="stat"
        [attr.data-tone]="item.tone"
        [attr.aria-label]="item.label + ': ' + item.value + '. Ver las palabras'"
        aria-haspopup="dialog"
        (click)="selected.emit(item.group)"
      >
        <span class="icon"><app-icon [name]="item.icon" [size]="20" /></span>
        <span class="label">{{ item.label }}</span>
        <span class="value">{{ item.value }}</span>
        <span class="caption">{{ item.caption }}</span>
        <app-icon class="chevron" name="chevron-right" [size]="18" />
      </button>
    }
  `,
})
export class ReviewStats {
  readonly overview = input.required<LearningOverview>();
  readonly selected = output<WordGroup>();

  protected readonly items = computed((): StatItem[] => {
    const { dueNow, counts } = this.overview();
    return [
      {
        group: 'due',
        label: 'Pendientes',
        value: dueNow,
        caption: 'Toca repasarlas ya',
        icon: 'clock',
        tone: 'warning',
      },
      {
        group: 'difficult',
        label: 'Difíciles',
        value: counts.difficult,
        caption: 'Las que más te cuestan',
        icon: 'alert',
        tone: 'danger',
      },
      {
        group: 'mastered',
        label: 'Dominadas',
        value: counts.provisional + counts.learned,
        caption: `${counts.learned} aprendidas · ${counts.provisional} por comprobar`,
        icon: 'star',
        tone: 'success',
      },
    ];
  });
}
