import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Barra de progreso accesible (role="progressbar"). `label` es su nombre accesible. */
@Component({
  selector: 'app-progress-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'progressbar',
    'aria-valuemin': '0',
    '[attr.aria-valuemax]': 'max()',
    '[attr.aria-valuenow]': 'clampedValue()',
    '[attr.aria-label]': 'label()',
    '[attr.data-tone]': 'tone()',
  },
  styles: `
    :host {
      --progress-fill: var(--color-primary);
      display: block;
      height: 0.5rem;
      overflow: hidden;
      background: var(--color-surface-sunken);
      border-radius: var(--radius-full);
      box-shadow: inset 0 0 0 1px var(--color-border);
    }
    :host([data-tone='success']) {
      --progress-fill: var(--color-success);
    }
    .fill {
      height: 100%;
      background: var(--progress-fill);
      border-radius: inherit;
      transform-origin: left center;
      /* scaleX en lugar de width: solo transform, sin recalcular layout. */
      transition: transform 250ms var(--ease-out);
    }
    @media (prefers-reduced-motion: reduce) {
      .fill {
        transition: none;
      }
    }
  `,
  template: `<div class="fill" [style.transform]="'scaleX(' + ratio() + ')'"></div>`,
})
export class ProgressBar {
  readonly value = input.required<number>();
  readonly max = input(100);
  readonly label = input.required<string>();
  readonly tone = input<'primary' | 'success'>('primary');

  protected readonly clampedValue = computed(() => Math.min(Math.max(this.value(), 0), this.max()));
  protected readonly ratio = computed(() =>
    this.max() > 0 ? this.clampedValue() / this.max() : 0,
  );
}
