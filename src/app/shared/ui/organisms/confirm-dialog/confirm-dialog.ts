import { ChangeDetectionStrategy, Component, inject, linkedSignal } from '@angular/core';
import { ConfirmRequest, ConfirmService } from '../../../../core/feedback/confirm.service';
import { Button } from '../../atoms/button/button';
import { Modal } from '../modal/modal';

/** Confirmación accesible (sustituye a window.confirm). Se monta una vez en el layout. */
@Component({
  selector: 'app-confirm-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Button, Modal],
  styleUrl: './confirm-dialog.scss',
  template: `
    <app-modal
      [open]="!!request()"
      [title]="shown()?.title ?? ''"
      [closable]="false"
      [describedBy]="shown()?.message ? 'confirm-message' : null"
      (closeRequested)="answer(false)"
    >
      @if (shown()?.message; as message) {
        <p id="confirm-message" class="message">{{ message }}</p>
      }
      <div class="actions">
        <!--
          Cancelar va primero en el DOM: showModal() enfoca el primer control, así Enter no elimina
          por accidente. (Sin "autofocus": provocaría un intento de autoenfoque al cargar la página.)
        -->
        <button appButton variant="secondary" type="button" (click)="answer(false)">
          {{ shown()?.cancelLabel }}
        </button>
        <button
          appButton
          type="button"
          [variant]="shown()?.tone === 'danger' ? 'danger' : 'primary'"
          (click)="answer(true)"
        >
          {{ shown()?.confirmLabel }}
        </button>
      </div>
    </app-modal>
  `,
})
export class ConfirmDialog {
  private readonly confirm = inject(ConfirmService);

  protected readonly request = this.confirm.request;

  /** Conserva el último contenido mientras se reproduce la transición de cierre. */
  protected readonly shown = linkedSignal<ConfirmRequest | null, ConfirmRequest | null>({
    source: this.confirm.request,
    computation: (request, previous) => request ?? previous?.value ?? null,
  });

  protected answer(confirmed: boolean): void {
    this.confirm.resolve(confirmed);
  }
}
