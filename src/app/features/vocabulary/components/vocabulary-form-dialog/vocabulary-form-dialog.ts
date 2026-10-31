import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  booleanAttribute,
  computed,
  effect,
  inject,
  Injector,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Button } from '../../../../shared/ui/atoms/button/button';
import { InputControl } from '../../../../shared/ui/atoms/input/input';
import { Icon } from '../../../../shared/ui/atoms/icon/icon';
import { FormField } from '../../../../shared/ui/molecules/form-field/form-field';
import { Modal } from '../../../../shared/ui/organisms/modal/modal';
import { controlErrorMessage, requiredText } from '../../../../shared/utils/form-errors';
import { toOptionalText } from '../../../../shared/utils/text';
import {
  EXAMPLE_MAX,
  NOTES_MAX,
  PRONUNCIATION_MAX,
  TERM_MAX,
  TRANSLATION_MAX,
  VocabularyInput,
  VocabularyItem,
} from '../../models/vocabulary-item';

export interface VocabularySaveRequest {
  readonly input: VocabularyInput;
  /** Tras guardar, dejar el formulario abierto y vacío para agregar otra palabra. */
  readonly addAnother: boolean;
}

@Component({
  selector: 'app-vocabulary-form-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, Button, InputControl, Icon, FormField, Modal],
  styleUrl: '../../../../shared/styles/form-dialog.scss',
  templateUrl: './vocabulary-form-dialog.html',
})
export class VocabularyFormDialog {
  readonly open = input(false, { transform: booleanAttribute });
  /** Palabra a editar; null para agregar una nueva. */
  readonly item = input<VocabularyItem | null>(null);
  readonly saving = input(false, { transform: booleanAttribute });
  readonly serverError = input<string | null>(null);
  /** Al cambiar, el formulario se vacía (flujo "Guardar y agregar otra"). */
  readonly resetToken = input(0);

  readonly save = output<VocabularySaveRequest>();
  readonly dismissed = output<void>();

  protected readonly limits = {
    term: TERM_MAX,
    translation: TRANSLATION_MAX,
    example: EXAMPLE_MAX,
    notes: NOTES_MAX,
    pronunciation: PRONUNCIATION_MAX,
  };

  protected readonly form = new FormGroup({
    term: new FormControl('', {
      nonNullable: true,
      validators: [requiredText, Validators.maxLength(TERM_MAX)],
    }),
    pronunciation: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(PRONUNCIATION_MAX)],
    }),
    translation: new FormControl('', {
      nonNullable: true,
      validators: [requiredText, Validators.maxLength(TRANSLATION_MAX)],
    }),
    example: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(EXAMPLE_MAX)],
    }),
    notes: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(NOTES_MAX)],
    }),
  });

  private readonly injector = inject(Injector);
  private readonly termInput = viewChild.required<ElementRef<HTMLInputElement>>('termInput');
  private readonly submitted = signal(false);
  private readonly formChanges = toSignal(this.form.events, { initialValue: null });

  protected readonly termError = computed(() => {
    this.formChanges();
    return controlErrorMessage(this.form.controls.term, this.submitted(), {
      required: 'Escribe la palabra o expresión en inglés.',
      maxlength: `Máximo ${TERM_MAX} caracteres.`,
    });
  });

  protected readonly translationError = computed(() => {
    this.formChanges();
    return controlErrorMessage(this.form.controls.translation, this.submitted(), {
      required: 'Escribe la traducción al español.',
      maxlength: `Máximo ${TRANSLATION_MAX} caracteres.`,
    });
  });

  protected readonly pronunciationError = computed(() => {
    this.formChanges();
    return controlErrorMessage(this.form.controls.pronunciation, this.submitted(), {
      maxlength: `Máximo ${PRONUNCIATION_MAX} caracteres.`,
    });
  });

  protected readonly exampleError = computed(() => {
    this.formChanges();
    return controlErrorMessage(this.form.controls.example, this.submitted(), {
      maxlength: `Máximo ${EXAMPLE_MAX} caracteres.`,
    });
  });

  protected readonly notesError = computed(() => {
    this.formChanges();
    return controlErrorMessage(this.form.controls.notes, this.submitted(), {
      maxlength: `Máximo ${NOTES_MAX} caracteres.`,
    });
  });

  constructor() {
    effect(() => {
      if (!this.open()) return;
      const item = this.item();
      const token = this.resetToken();
      untracked(() => {
        this.submitted.set(false);
        this.form.reset({
          term: item?.term ?? '',
          pronunciation: item?.pronunciation ?? '',
          translation: item?.translation ?? '',
          example: item?.example ?? '',
          notes: item?.notes ?? '',
        });
        // Tras "Guardar y agregar otra" el foco vuelve al primer campo.
        if (token > 0) {
          afterNextRender(() => this.termInput().nativeElement.focus(), {
            injector: this.injector,
          });
        }
      });
    });
  }

  protected submit(addAnother: boolean): void {
    this.submitted.set(true);
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving()) return;

    const { term, pronunciation, translation, example, notes } = this.form.getRawValue();
    this.save.emit({
      input: {
        term: term.trim().replace(/\s+/g, ' '),
        translation: translation.trim().replace(/\s+/g, ' '),
        example: toOptionalText(example),
        notes: toOptionalText(notes),
        pronunciation: toOptionalText(pronunciation.replace(/\s+/g, ' ')),
      },
      addAnother,
    });
  }
}
