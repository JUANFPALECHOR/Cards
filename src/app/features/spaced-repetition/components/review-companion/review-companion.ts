import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Icon, IconName } from '../../../../shared/ui/atoms/icon/icon';
import TIPS from '../../data/daily-tips.json';

type TipType = 'expression' | 'curiosity' | 'tip' | 'difference' | 'usage';

interface DailyTip {
  readonly type: TipType;
  readonly title: string;
  readonly body: string;
  readonly example?: string;
}

const TYPES: Record<TipType, { label: string; icon: IconName }> = {
  expression: { label: 'Expresión', icon: 'languages' },
  curiosity: { label: 'Curiosidad', icon: 'star' },
  tip: { label: 'Consejo práctico', icon: 'brain' },
  difference: { label: 'No las confundas', icon: 'target' },
  usage: { label: 'Uso natural', icon: 'book' },
};

const DAY = 86_400_000;

/** Índice del consejo de hoy: cambia a medianoche (hora local), no durante la sesión. */
export function dailyTipIndex(date: Date, count: number): number {
  const day = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY);
  return day % count;
}

/** Mascota y consejo del día. No intervienen en la cola ni en el registro del aprendizaje. */
@Component({
  selector: 'app-review-companion',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  styleUrl: './review-companion.scss',
  template: `
    <div class="mascot" aria-hidden="true">
      <span class="orb"></span>
      <span class="orbit orbit-one"></span>
      <span class="orbit orbit-two"></span>
      <span class="spark"></span>
      <img
        src="/images/review-cat.webp"
        width="880"
        height="880"
        alt=""
        draggable="false"
        loading="lazy"
        decoding="async"
      />
    </div>

    <aside class="tip" aria-labelledby="daily-tip-title">
      <header class="tip-header">
        <span class="bulb"><app-icon name="bulb" [size]="22" /></span>
        <h2 id="daily-tip-title">Consejo del día</h2>
        <span class="kind"><app-icon [name]="type.icon" [size]="14" /> {{ type.label }}</span>
      </header>
      <h3>{{ tip.title }}</h3>
      <p>{{ tip.body }}</p>
      @if (tip.example; as example) {
        <p class="example" lang="en">{{ example }}</p>
      }
    </aside>
  `,
})
export class ReviewCompanion {
  protected readonly tip: DailyTip = (TIPS as DailyTip[])[dailyTipIndex(new Date(), TIPS.length)];
  protected readonly type = TYPES[this.tip.type];
}
