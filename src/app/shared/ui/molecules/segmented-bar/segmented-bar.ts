import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  input,
} from '@angular/core';
import { toPercent } from '../../../utils/numbers';

export interface BarSegment {
  readonly key: string;
  readonly label: string;
  readonly value: number;
  /** Color CSS del segmento (p. ej. `var(--color-status-learned)`). */
  readonly color: string;
}

/**
 * Barra de partes de un total: cada segmento ocupa su proporción, separado por un hueco de 2 px.
 * Con leyenda, la información está en texto (etiqueta, cantidad y porcentaje) y la barra es
 * decorativa; en modo compacto la barra lleva la descripción completa como nombre accesible.
 */
@Component({
  selector: 'app-segmented-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.is-compact]': 'compact()' },
  styles: `
    :host {
      --bar-height: 0.75rem;
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
    }
    :host(.is-compact) {
      gap: 0;
    }
    .track {
      display: flex;
      gap: 2px;
      height: var(--bar-height);
      overflow: hidden;
      border-radius: var(--radius-full);
    }
    .track.is-empty {
      background: var(--color-surface-sunken);
      box-shadow: inset 0 0 0 1px var(--color-border);
    }
    .segment {
      flex: 0 1 0;
      /* Un segmento pequeño (1 de 500) sigue siendo visible. */
      min-width: 0.375rem;
      transition: flex-grow 300ms var(--ease-out);
    }
    .legend {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2) var(--space-5);
      margin: 0;
      padding: 0;
      list-style: none;
      font-size: var(--font-size-sm);
    }
    .legend-item {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      color: var(--color-text-muted);
    }
    .swatch {
      width: 0.75rem;
      height: 0.75rem;
      flex-shrink: 0;
      border-radius: 3px;
    }
    .legend-value {
      font-weight: var(--font-weight-semibold);
      color: var(--color-text);
      font-variant-numeric: tabular-nums;
    }
    @media (prefers-reduced-motion: reduce) {
      .segment {
        transition: none;
      }
    }
  `,
  template: `
    <div
      class="track"
      [class.is-empty]="total() === 0"
      [attr.role]="compact() ? 'img' : null"
      [attr.aria-label]="compact() ? description() : null"
      [attr.aria-hidden]="compact() ? null : 'true'"
    >
      @for (segment of visible(); track segment.key) {
        <span
          class="segment"
          [style.flex-grow]="segment.value"
          [style.background]="segment.color"
          [attr.title]="segment.label + ': ' + segment.value"
        ></span>
      }
    </div>
    @if (!compact()) {
      <ul class="legend" [attr.aria-label]="label()">
        @for (segment of segments(); track segment.key) {
          <li class="legend-item">
            <span class="swatch" [style.background]="segment.color"></span>
            <span>
              {{ segment.label }} <strong class="legend-value">{{ segment.value }}</strong> ({{
                percentOf(segment.value)
              }}%)
            </span>
          </li>
        }
      </ul>
    }
  `,
})
export class SegmentedBar {
  readonly segments = input.required<readonly BarSegment[]>();
  /** Qué representa la barra (nombre accesible). */
  readonly label = input.required<string>();
  /** Sin leyenda: para espacios pequeños como las tarjetas de conjunto. */
  readonly compact = input(false, { transform: booleanAttribute });

  protected readonly total = computed(() =>
    this.segments().reduce((sum, segment) => sum + segment.value, 0),
  );
  protected readonly visible = computed(() => this.segments().filter((s) => s.value > 0));
  protected readonly description = computed(() => {
    const parts = this.segments().map((segment) => `${segment.label}: ${segment.value}`);
    return `${this.label()}. ${parts.join(', ')}.`;
  });

  protected percentOf(value: number): number {
    return toPercent(value, this.total());
  }
}
