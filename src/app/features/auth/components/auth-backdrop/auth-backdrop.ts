import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Fondos y cintas decorativos construidos únicamente con SCSS. */
@Component({
  selector: 'app-auth-backdrop',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true', '[attr.data-variant]': 'variant()' },
  styleUrl: './auth-backdrop.scss',
  template: `
    @if (variant() === 'page') {
      <span class="wash"></span>
      <span class="wave wave-left"></span>
      <span class="wave wave-right"></span>
      <span class="red-ribbon"></span>
    } @else {
      <div class="card-decoration"><i></i><i></i><i></i></div>
    }
  `,
})
export class AuthBackdrop {
  readonly variant = input<'page' | 'corner'>('page');
}
