import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';
import { safeReturnUrl } from '../../../../core/auth/auth.guard';
import { toAppError } from '../../../../core/supabase/app-error';
import { Button } from '../../../../shared/ui/atoms/button/button';
import { Icon } from '../../../../shared/ui/atoms/icon/icon';
import { IconButton } from '../../../../shared/ui/atoms/icon-button/icon-button';
import { InputControl } from '../../../../shared/ui/atoms/input/input';
import { EmptyState } from '../../../../shared/ui/molecules/empty-state/empty-state';
import { FormField } from '../../../../shared/ui/molecules/form-field/form-field';
import { controlErrorMessage, requiredText } from '../../../../shared/utils/form-errors';
import { AuthArtwork } from '../../components/auth-artwork/auth-artwork';
import { AuthBackdrop } from '../../components/auth-backdrop/auth-backdrop';

export type AuthMode = 'login' | 'register';

export const PASSWORD_MIN_LENGTH = 8;

/** Iniciar sesión o crear cuenta con correo y contraseña. El modo llega por los datos de la ruta. */
@Component({
  selector: 'app-auth-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    Button,
    Icon,
    IconButton,
    InputControl,
    FormField,
    EmptyState,
    AuthArtwork,
    AuthBackdrop,
  ],
  templateUrl: './auth-page.html',
  styleUrl: './auth-page.scss',
})
export class AuthPage {
  readonly mode = input<AuthMode>('login');
  /** Ruta a la que volver tras acceder (query param `returnUrl`). */
  readonly returnUrl = input<string | undefined>(undefined);

  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly passwordMin = PASSWORD_MIN_LENGTH;
  protected readonly isRegister = computed(() => this.mode() === 'register');
  protected readonly passwordVisible = signal(false);
  protected readonly confirmationVisible = signal(false);

  protected readonly form = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [requiredText, Validators.email],
    }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    confirmPassword: new FormControl('', { nonNullable: true }),
  });

  protected readonly submitting = signal(false);
  protected readonly serverError = signal<string | null>(null);
  /** Correo al que se envió el enlace de confirmación (solo si el proyecto lo exige). */
  protected readonly pendingConfirmation = signal<string | null>(null);

  private readonly submitted = signal(false);
  private readonly formChanges = toSignal(this.form.events, { initialValue: null });

  protected readonly emailError = computed(() => {
    this.formChanges();
    return controlErrorMessage(this.form.controls.email, this.submitted(), {
      required: 'Escribe tu correo electrónico.',
      email: 'Escribe un correo válido, por ejemplo nombre@correo.com.',
    });
  });

  protected readonly passwordError = computed(() => {
    this.formChanges();
    return controlErrorMessage(this.form.controls.password, this.submitted(), {
      required: 'Escribe tu contraseña.',
      minlength: `Usa al menos ${PASSWORD_MIN_LENGTH} caracteres.`,
    });
  });

  protected readonly confirmError = computed(() => {
    this.formChanges();
    if (!this.isRegister()) return null;
    const { password, confirmPassword } = this.form.controls;
    if (!(confirmPassword.touched || this.submitted())) return null;
    if (!confirmPassword.value) return 'Repite la contraseña.';
    return confirmPassword.value === password.value ? null : 'Las contraseñas no coinciden.';
  });

  constructor() {
    // La longitud mínima solo se exige al crear la cuenta; al iniciar sesión basta con que no esté vacía.
    effect(() => {
      const register = this.isRegister();
      untracked(() => {
        this.passwordVisible.set(false);
        this.confirmationVisible.set(false);
        const { password } = this.form.controls;
        password.setValidators(
          register
            ? [Validators.required, Validators.minLength(PASSWORD_MIN_LENGTH)]
            : [Validators.required],
        );
        password.updateValueAndValidity();
      });
    });
  }

  protected async submit(): Promise<void> {
    this.submitted.set(true);
    this.form.markAllAsTouched();
    if (this.submitting()) return;
    if (this.form.invalid || this.confirmError()) return;

    const email = this.form.controls.email.value.trim();
    const password = this.form.controls.password.value;

    this.submitting.set(true);
    this.serverError.set(null);
    try {
      if (this.isRegister()) {
        const result = await this.auth.signUp({ email, password });
        if (result === 'confirmation-required') {
          this.pendingConfirmation.set(email);
          return;
        }
      } else {
        await this.auth.signIn({ email, password });
      }
      await this.router.navigateByUrl(safeReturnUrl(this.returnUrl()) ?? '/sets');
    } catch (error) {
      this.serverError.set(toAppError(error).message);
    } finally {
      this.submitting.set(false);
    }
  }
}
