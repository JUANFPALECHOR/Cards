import { ChangeDetectionStrategy, Component, booleanAttribute, input } from '@angular/core';
import { Spinner } from '../spinner/spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

/**
 * Botón sobre el elemento nativo (<button appButton> o <a appButton>), conservando su semántica.
 * Con `loading` muestra un spinner y marca aria-busy; el consumidor decide si además lo deshabilita.
 */
@Component({
  selector: 'button[appButton], a[appButton]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Spinner],
  host: {
    class: 'btn',
    '[attr.data-variant]': 'variant()',
    '[attr.data-size]': 'size()',
    '[class.btn-block]': 'block()',
    '[attr.aria-busy]': 'loading() || null',
  },
  styleUrl: './button.scss',
  template: `
    @if (loading()) {
      <app-spinner [size]="size() === 'sm' ? 16 : 18" />
    }
    <ng-content />
  `,
})
export class Button {
  readonly variant = input<ButtonVariant>('primary');
  readonly size = input<ButtonSize>('md');
  readonly block = input(false, { transform: booleanAttribute });
  readonly loading = input(false, { transform: booleanAttribute });
}
