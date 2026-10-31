import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { Icon, IconName } from '../../../../shared/ui/atoms/icon/icon';
import { IconButton } from '../../../../shared/ui/atoms/icon-button/icon-button';

const TIPS: readonly { title: string; description: string; icon: IconName }[] = [
  {
    title: 'Sé constante',
    description: 'Unos minutos al día son más efectivos que sesiones largas y esporádicas.',
    icon: 'calendar',
  },
  {
    title: 'Enfócate en lo difícil',
    description: 'El sistema prioriza las palabras que más te cuestan.',
    icon: 'chart',
  },
  {
    title: 'Repasa en el momento justo',
    description: 'Verás cada palabra cuando realmente necesites reforzarla.',
    icon: 'repeat',
  },
];

/** Consejos de presentación: no intervienen en la cola ni en el registro del aprendizaje. */
@Component({
  selector: 'app-review-companion',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, IconButton],
  styleUrl: './review-companion.scss',
  template: `
    <div class="mascot" aria-hidden="true">
      <span class="orb"></span>
      <span class="orbit orbit-one"></span>
      <span class="orbit orbit-two"></span>
      <span class="spark"></span>
      <img
        src="/images/review-cat.png"
        width="1254"
        height="1254"
        alt=""
        draggable="false"
        decoding="async"
      />
    </div>

    <aside class="tips" aria-labelledby="review-tips-title">
      <header class="tips-header">
        <span class="bulb"><app-icon name="bulb" [size]="25" /></span>
        <h2 id="review-tips-title">Consejos</h2>
        <span class="counter" aria-label="Consejo actual"
          >{{ activeIndex() + 1 }} / {{ tips.length }}</span
        >
        <div class="tip-navigation">
          <button
            appIconButton
            size="sm"
            label="Consejo anterior"
            [disabled]="activeIndex() === 0"
            (click)="selectTip(activeIndex() - 1)"
          >
            <app-icon name="chevron-left" />
          </button>
          <button
            appIconButton
            size="sm"
            label="Consejo siguiente"
            [disabled]="activeIndex() === tips.length - 1"
            (click)="selectTip(activeIndex() + 1)"
          >
            <app-icon name="chevron-right" />
          </button>
        </div>
      </header>

      <div class="featured-tip" aria-live="polite" aria-atomic="true">
        <span class="tip-icon"><app-icon [name]="activeTip().icon" [size]="30" /></span>
        <div>
          <h3>{{ activeTip().title }}</h3>
          <p>{{ activeTip().description }}</p>
        </div>
      </div>
      <div class="tip-pages" aria-label="Elegir un consejo">
        @for (tip of tips; track tip.title; let index = $index) {
          <button
            type="button"
            [attr.aria-label]="tip.title"
            [attr.aria-pressed]="activeIndex() === index"
            (click)="selectTip(index)"
          ></button>
        }
      </div>

      @for (tip of otherTips(); track tip.title) {
        <div class="tip-row">
          <span class="tip-icon"><app-icon [name]="tip.icon" [size]="30" /></span>
          <div>
            <h3>{{ tip.title }}</h3>
            <p>{{ tip.description }}</p>
          </div>
        </div>
      }
    </aside>
  `,
})
export class ReviewCompanion {
  protected readonly tips = TIPS;
  protected readonly activeIndex = signal(0);
  protected readonly activeTip = computed(() => TIPS[this.activeIndex()]);
  protected readonly otherTips = computed(() =>
    TIPS.filter((_, index) => index !== this.activeIndex()),
  );

  protected selectTip(index: number): void {
    this.activeIndex.set(Math.max(0, Math.min(TIPS.length - 1, index)));
  }
}
