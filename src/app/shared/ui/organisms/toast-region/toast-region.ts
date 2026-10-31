import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastKind, ToastService } from '../../../../core/feedback/toast.service';
import { Icon, IconName } from '../../atoms/icon/icon';
import { IconButton } from '../../atoms/icon-button/icon-button';

const ICONS: Record<ToastKind, IconName> = {
  success: 'check',
  error: 'alert',
  info: 'info',
};

/**
 * Notificaciones no bloqueantes. La región es persistente (aria-live="polite") para que
 * los lectores de pantalla anuncien lo que se inserta; los errores usan role="alert".
 */
@Component({
  selector: 'app-toast-region',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, IconButton],
  styleUrl: './toast-region.scss',
  template: `
    <ol aria-live="polite" aria-label="Notificaciones">
      @for (toast of toasts(); track toast.id) {
        <li
          class="toast"
          [attr.data-kind]="toast.kind"
          [class.is-leaving]="toast.leaving"
          [attr.role]="toast.kind === 'error' ? 'alert' : null"
          (mouseenter)="pause(toast.id)"
          (mouseleave)="resume(toast.id)"
          (focusin)="pause(toast.id)"
          (focusout)="resume(toast.id)"
        >
          <app-icon class="toast-icon" [name]="icon(toast.kind)" />
          <p class="toast-message">{{ toast.message }}</p>
          <button appIconButton size="sm" label="Cerrar notificación" (click)="dismiss(toast.id)">
            <app-icon name="close" [size]="16" />
          </button>
        </li>
      }
    </ol>
  `,
})
export class ToastRegion {
  private readonly toastService = inject(ToastService);

  protected readonly toasts = this.toastService.toasts;

  protected icon(kind: ToastKind): IconName {
    return ICONS[kind];
  }

  protected dismiss(id: number): void {
    this.toastService.dismiss(id);
  }

  protected pause(id: number): void {
    this.toastService.pause(id);
  }

  protected resume(id: number): void {
    this.toastService.resume(id);
  }
}
