import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  untracked,
  viewChild,
} from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { toAppError } from '../../../core/supabase/app-error';
import { ToastService } from '../../../core/feedback/toast.service';
import { NavItem } from '../../ui/organisms/nav-item';
import { Topbar } from '../../ui/organisms/topbar/topbar';
import { MobileNav } from '../../ui/organisms/mobile-nav/mobile-nav';
import { ToastRegion } from '../../ui/organisms/toast-region/toast-region';
import { ConfirmDialog } from '../../ui/organisms/confirm-dialog/confirm-dialog';

export const MAIN_NAV: readonly NavItem[] = [
  { label: 'Conjuntos', path: '/sets', icon: 'stack' },
  { label: 'Repasar', path: '/review', icon: 'repeat' },
  { label: 'Emparejar', path: '/match', icon: 'bolt' },
  { label: 'Progreso', path: '/progress', icon: 'chart' },
];

/** Estructura común: topbar, contenido, navegación móvil y capas globales (toasts, diálogo). */
@Component({
  selector: 'app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, Topbar, MobileNav, ToastRegion, ConfirmDialog],
  styleUrl: './app-shell.scss',
  template: `
    <a class="skip-link" href="#main" (click)="skipToContent($event)">Saltar al contenido</a>
    <app-topbar
      [items]="navItems()"
      [email]="auth.email()"
      homePath="/sets"
      (signOutRequested)="signOut()"
    />
    <main #main id="main" class="container" tabindex="-1">
      <router-outlet />
    </main>
    @if (signedIn()) {
      <app-mobile-nav [items]="nav" />
    }
    <app-toast-region />
    <app-confirm-dialog />
  `,
})
export class AppShell {
  protected readonly nav = MAIN_NAV;
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);
  private readonly main = viewChild.required<ElementRef<HTMLElement>>('main');

  protected readonly signedIn = computed(() => this.auth.status() === 'signed-in');
  protected readonly navItems = computed(() => (this.signedIn() ? this.nav : []));

  constructor() {
    // Si la sesión termina fuera de este flujo (otra pestaña, token revocado), se vuelve al acceso.
    let wasSignedIn = false;
    effect(() => {
      const signedIn = this.signedIn();
      untracked(() => {
        if (wasSignedIn && !signedIn) void this.router.navigate(['/login']);
        wasSignedIn = signedIn;
      });
    });
  }

  protected async signOut(): Promise<void> {
    try {
      await this.auth.signOut();
    } catch (error) {
      this.toasts.error(toAppError(error).message);
    }
  }

  /** Con <base href="/">, un enlace "#main" navegaría a la raíz: se enfoca el contenido a mano. */
  protected skipToContent(event: Event): void {
    event.preventDefault();
    this.main().nativeElement.focus();
  }
}
