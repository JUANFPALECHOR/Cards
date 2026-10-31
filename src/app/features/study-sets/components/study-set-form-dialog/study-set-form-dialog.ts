import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  effect,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Button } from '../../../../shared/ui/atoms/button/button';
import { InputControl } from '../../../../shared/ui/atoms/input/input';
import { FormField } from '../../../../shared/ui/molecules/form-field/form-field';
import { Modal } from '../../../../shared/ui/organisms/modal/modal';
import { controlErrorMessage, requiredText } from '../../../../shared/utils/form-errors';
import { toOptionalText } from '../../../../shared/utils/text';
import {
  STUDY_SET_DESCRIPTION_MAX,
  STUDY_SET_NAME_MAX,
  StudySet,
  StudySetInput,
} from '../../models/study-set';

/** Formulario para crear o editar un conjunto. La página decide qué hacer con `save`. */
@Component({
  selector: 'app-study-set-form-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, Button, InputControl, FormField, Modal],
  styleUrl: '../../../../shared/styles/form-dialog.scss',
  template: `
    <app-modal
      size="md"
      [open]="open()"
      [title]="set() ? 'Editar conjunto' : 'Nuevo conjunto'"
      [description]="
        set()
          ? 'Actualiza el nombre o la descripción de tu conjunto.'
          : 'Dale un nombre a tu conjunto. Después podrás añadir las palabras que quieras practicar.'
      "
      [dismissDisabled]="saving()"
      (closeRequested)="dismissed.emit()"
    >
      <form class="form" [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <app-form-field label="Nombre del conjunto" [error]="nameError()" required>
          <input
            appInput
            formControlName="name"
            autocomplete="off"
            autofocus
            enterkeyhint="next"
            [attr.maxlength]="nameMax"
            placeholder="Por ejemplo: Verbos irregulares"
          />
        </app-form-field>
        <app-form-field
          label="Descripción (opcional)"
          hint="Una frase para recordar qué vas a aprender."
          [error]="descriptionError()"
        >
          <textarea
            appInput
            formControlName="description"
            rows="3"
            placeholder="Por ejemplo: Verbos que uso para hablar de mi día a día."
            [attr.maxlength]="descriptionMax"
          ></textarea>
        </app-form-field>

        @if (serverError(); as message) {
          <p class="form-error" role="alert">{{ message }}</p>
        }

        <div class="form-actions">
          <button
            appButton
            variant="secondary"
            type="button"
            [disabled]="saving()"
            (click)="dismissed.emit()"
          >
            Cancelar
          </button>
          <button appButton type="submit" [loading]="saving()" [disabled]="saving()">
            {{ set() ? 'Guardar cambios' : 'Crear conjunto' }}
          </button>
        </div>
      </form>
    </app-modal>
  `,
})
export class StudySetFormDialog {
  readonly open = input(false, { transform: booleanAttribute });
  /** Conjunto a editar; null para crear uno nuevo. */
  readonly set = input<StudySet | null>(null);
  readonly saving = input(false, { transform: booleanAttribute });
  readonly serverError = input<string | null>(null);

  readonly save = output<StudySetInput>();
  readonly dismissed = output<void>();

  protected readonly nameMax = STUDY_SET_NAME_MAX;
  protected readonly descriptionMax = STUDY_SET_DESCRIPTION_MAX;

  protected readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [requiredText, Validators.maxLength(STUDY_SET_NAME_MAX)],
    }),
    description: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(STUDY_SET_DESCRIPTION_MAX)],
    }),
  });

  private readonly submitted = signal(false);
  private readonly formChanges = toSignal(this.form.events, { initialValue: null });

  protected readonly nameError = computed(() => {
    this.formChanges();
    return controlErrorMessage(this.form.controls.name, this.submitted(), {
      required: 'Escribe un nombre para el conjunto.',
      maxlength: `El nombre admite como máximo ${STUDY_SET_NAME_MAX} caracteres.`,
    });
  });

  protected readonly descriptionError = computed(() => {
    this.formChanges();
    return controlErrorMessage(this.form.controls.description, this.submitted(), {
      maxlength: `La descripción admite como máximo ${STUDY_SET_DESCRIPTION_MAX} caracteres.`,
    });
  });

  constructor() {
    // Cada vez que se abre, el formulario parte de los datos actuales del conjunto (o vacío).
    effect(() => {
      if (!this.open()) return;
      const set = this.set();
      untracked(() => {
        this.submitted.set(false);
        this.form.reset({ name: set?.name ?? '', description: set?.description ?? '' });
      });
    });
  }

  protected submit(): void {
    this.submitted.set(true);
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving()) return;

    const { name, description } = this.form.getRawValue();
    this.save.emit({ name: name.trim(), description: toOptionalText(description) });
  }
}
