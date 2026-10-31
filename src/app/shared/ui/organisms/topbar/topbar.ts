import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Icon } from '../../atoms/icon/icon';
import { IconButton } from '../../atoms/icon-button/icon-button';
import { ThemeToggle } from '../../molecules/theme-toggle/theme-toggle';
import { NavItem } from '../nav-item';

/**
 * Barra superior. En escritorio muestra la navegación principal;
 * en móvil se simplifica (marca, tema y salir) y la navegación pasa a MobileNav.
 * Sin `items` ni `email` (pantallas de acceso) solo quedan la marca y el tema.
 */
@Component({
  selector: 'app-topbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, Icon, IconButton, ThemeToggle],
  styleUrl: './topbar.scss',
  template: `
    <header class="topbar">
      <div class="container inner">
        <a class="brand" [routerLink]="homePath()">
          <svg class="logo" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
            <rect
              class="logo-back"
              x="3.5"
              y="7"
              width="17"
              height="21"
              rx="4"
              transform="rotate(-12 12 17.5)"
            />
            <rect class="logo-front" x="11" y="4" width="17.5" height="22" rx="4" />
            <path class="logo-lines" d="M15.5 11h8.5M15.5 15.5h5.5" />
          </svg>
          <span class="brand-name" lang="en">English Learning</span>
        </a>

        <nav class="nav" aria-label="Principal">
          <ul>
            @for (item of items(); track item.path) {
              <li>
                <a
                  class="nav-link"
                  [routerLink]="item.path"
                  routerLinkActive="is-active"
                  ariaCurrentWhenActive="page"
                >
                  <app-icon [name]="item.icon" [size]="18" />
                  {{ item.label }}
                </a>
              </li>
            }
          </ul>
        </nav>

        <div class="actions">
          <app-theme-toggle />
          @if (email(); as address) {
            <span class="account" [title]="address">{{ address }}</span>
            <button appIconButton label="Cerrar sesión" (click)="signOutRequested.emit()">
              <app-icon name="logout" [size]="20" />
            </button>
          }
        </div>
      </div>
    </header>
  `,
})
export class Topbar {
  readonly items = input.required<readonly NavItem[]>();
  readonly homePath = input('/');
  /** Correo de la cuenta activa; null cuando no hay sesión. */
  readonly email = input<string | null>(null);
  readonly signOutRequested = output<void>();
}
