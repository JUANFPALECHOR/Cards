import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  booleanAttribute,
  effect,
  input,
  output,
  viewChild,
} from '@angular/core';
import { Icon } from '../../atoms/icon/icon';
import { IconButton } from '../../atoms/icon-button/icon-button';

let nextId = 0;

/**
 * Ventana modal sobre <dialog> nativo: foco atrapado, Escape y retorno del foco al disparador
 * los gestiona el navegador. El padre controla `open` y decide qué hacer con `closeRequested`.
 * Para enfocar un campo al abrir, márcalo con el atributo `autofocus`.
 */
@Component({
  selector: 'app-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, IconButton],
  host: { '[attr.data-size]': 'size()' },
  styleUrl: './modal.scss',
  template: `
    <dialog
      #dialog
      [attr.aria-labelledby]="titleId"
      [attr.aria-describedby]="describedBy() ?? (description() ? descriptionId : null)"
      (cancel)="onCancel($event)"
      (click)="onDialogClick($event)"
    >
      <div class="panel">
        <div class="header">
          <div class="heading">
            <h2 class="title" [id]="titleId">{{ title() }}</h2>
            @if (description(); as text) {
              <p class="description" [id]="descriptionId">{{ text }}</p>
            }
          </div>
          @if (closable()) {
            <button
              appIconButton
              size="sm"
              class="close"
              label="Cerrar"
              [disabled]="dismissDisabled()"
              (click)="requestClose()"
            >
              <app-icon name="close" [size]="18" />
            </button>
          }
        </div>
        <ng-content />
      </div>
    </dialog>
  `,
})
export class Modal {
  readonly open = input(false, { transform: booleanAttribute });
  readonly title = input.required<string>();
  readonly description = input<string | null>(null);
  readonly describedBy = input<string | null>(null);
  readonly closable = input(true, { transform: booleanAttribute });
  /** Impide cerrar (p. ej. mientras se guarda). */
  readonly dismissDisabled = input(false, { transform: booleanAttribute });
  readonly size = input<'sm' | 'md'>('sm');

  readonly closeRequested = output<void>();

  protected readonly titleId = `modal-title-${++nextId}`;
  protected readonly descriptionId = `${this.titleId}-description`;
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    effect(() => {
      const dialog = this.dialog().nativeElement;
      if (this.open() && !dialog.open) {
        dialog.showModal?.();
      } else if (!this.open() && dialog.open) {
        dialog.close();
      }
    });
  }

  protected requestClose(): void {
    if (!this.dismissDisabled()) {
      this.closeRequested.emit();
    }
  }

  /** Escape: el padre decide; el diálogo no se cierra por su cuenta. */
  protected onCancel(event: Event): void {
    event.preventDefault();
    this.requestClose();
  }

  /** Un clic cuyo destino es el propio <dialog> solo puede venir del fondo (backdrop). */
  protected onDialogClick(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement) {
      this.requestClose();
    }
  }
}
