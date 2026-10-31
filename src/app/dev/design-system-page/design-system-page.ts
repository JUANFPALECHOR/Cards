import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { map } from 'rxjs';
import { ConfirmService } from '../../core/feedback/confirm.service';
import { ToastService } from '../../core/feedback/toast.service';
import { Badge, BadgeTone } from '../../shared/ui/atoms/badge/badge';
import { Button } from '../../shared/ui/atoms/button/button';
import { Icon } from '../../shared/ui/atoms/icon/icon';
import { IconButton } from '../../shared/ui/atoms/icon-button/icon-button';
import { InputControl } from '../../shared/ui/atoms/input/input';
import { Skeleton } from '../../shared/ui/atoms/skeleton/skeleton';
import { Spinner } from '../../shared/ui/atoms/spinner/spinner';
import { EmptyState } from '../../shared/ui/molecules/empty-state/empty-state';
import { FormField } from '../../shared/ui/molecules/form-field/form-field';
import { PageHeader } from '../../shared/ui/molecules/page-header/page-header';
import { ProgressBar } from '../../shared/ui/molecules/progress-bar/progress-bar';
import { SearchField } from '../../shared/ui/molecules/search-field/search-field';
import {
  SegmentOption,
  SegmentedControl,
} from '../../shared/ui/molecules/segmented-control/segmented-control';
import { StatTile } from '../../shared/ui/molecules/stat-tile/stat-tile';
import { Flashcard } from '../../features/flashcards/components/flashcard/flashcard';

interface Swatch {
  readonly name: string;
  readonly token: string;
}

/**
 * Catálogo del sistema de diseño (solo desarrollo, ver app.routes.ts).
 * Sirve para revisar tokens y componentes en ambos temas y tamaños de pantalla.
 */
@Component({
  selector: 'app-design-system-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    Badge,
    Button,
    Icon,
    IconButton,
    InputControl,
    Skeleton,
    Spinner,
    EmptyState,
    FormField,
    PageHeader,
    ProgressBar,
    SearchField,
    SegmentedControl,
    StatTile,
    Flashcard,
  ],
  templateUrl: './design-system-page.html',
  styleUrl: './design-system-page.scss',
})
export class DesignSystemPage {
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);

  protected readonly swatches: readonly Swatch[] = [
    { name: 'Primario', token: '--color-primary' },
    { name: 'Primario suave', token: '--color-primary-soft' },
    { name: 'Acento', token: '--color-accent' },
    { name: 'Acento suave', token: '--color-accent-soft' },
    { name: 'Éxito', token: '--color-success' },
    { name: 'Error', token: '--color-danger' },
    { name: 'Advertencia', token: '--color-warning' },
    { name: 'Información', token: '--color-info' },
    { name: 'Fondo', token: '--color-bg' },
    { name: 'Superficie', token: '--color-surface' },
    { name: 'Borde', token: '--color-border' },
    { name: 'Texto', token: '--color-text' },
  ];

  protected readonly tones: readonly BadgeTone[] = [
    'neutral',
    'primary',
    'accent',
    'success',
    'danger',
    'warning',
    'info',
  ];

  protected readonly progress = signal(40);
  protected readonly flipped = signal(false);
  protected readonly mode = signal<'a' | 'b' | 'c'>('a');
  protected readonly modeOptions: readonly SegmentOption<'a' | 'b' | 'c'>[] = [
    { value: 'a', label: 'Inglés → Español', description: 'Opción con descripción' },
    { value: 'b', label: 'Español → Inglés' },
    { value: 'c', label: 'Deshabilitada', disabled: true },
  ];
  protected readonly query = signal('');

  protected readonly name = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(100)],
  });
  protected readonly notes = new FormControl('', { nonNullable: true });

  protected readonly nameError = toSignal(
    this.name.events.pipe(map(() => this.describeNameError())),
    { initialValue: null },
  );

  protected changeProgress(delta: number): void {
    this.progress.update((value) => Math.min(Math.max(value + delta, 0), 100));
  }

  protected submit(): void {
    this.name.markAsTouched();
    if (this.name.valid) {
      this.toast.success('El formulario de ejemplo es válido.');
    }
  }

  protected showToast(kind: 'success' | 'info' | 'error'): void {
    const messages = {
      success: 'Cambios guardados.',
      info: 'Este es un mensaje informativo.',
      error: 'No se pudo completar la acción. Inténtalo de nuevo.',
    };
    this.toast[kind](messages[kind]);
  }

  protected async askDelete(): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: '¿Eliminar este conjunto?',
      message: 'También se eliminarán sus palabras. Esta acción no se puede deshacer.',
      confirmLabel: 'Eliminar',
      tone: 'danger',
    });
    this.toast.info(confirmed ? 'Confirmaste la acción (ejemplo).' : 'Acción cancelada.');
  }

  private describeNameError(): string | null {
    if (!this.name.touched) return null;
    if (this.name.hasError('required')) return 'Escribe un nombre para el conjunto.';
    if (this.name.hasError('maxlength')) return 'El nombre admite como máximo 100 caracteres.';
    return null;
  }
}
