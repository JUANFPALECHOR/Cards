import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Icon } from '../../atoms/icon/icon';
import { NavItem } from '../nav-item';

/** Navegación inferior para móvil (oculta desde el breakpoint md). */
@Component({
  selector: 'app-mobile-nav',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, Icon],
  styleUrl: './mobile-nav.scss',
  template: `
    <nav aria-label="Principal">
      <ul>
        @for (item of items(); track item.path) {
          <li>
            <a
              class="tab"
              [routerLink]="item.path"
              routerLinkActive="is-active"
              ariaCurrentWhenActive="page"
            >
              <span class="tab-icon"><app-icon [name]="item.icon" [size]="22" /></span>
              <span class="tab-label">{{ item.label }}</span>
            </a>
          </li>
        }
      </ul>
    </nav>
  `,
})
export class MobileNav {
  readonly items = input.required<readonly NavItem[]>();
}
