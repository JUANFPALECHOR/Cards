import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';
import { AppError } from '../../../../core/supabase/app-error';
import { THEME_STORAGE } from '../../../../core/theme/theme.service';
import { MemoryStorage } from '../../../../../testing/memory-storage';
import { createAuthStub } from '../../../../../testing/auth-stub';
import { AuthPage, AuthMode } from './auth-page';

describe('AuthPage', () => {
  let auth: ReturnType<typeof createAuthStub>;
  let navigate: ReturnType<typeof vi.fn>;
  let fixture: ComponentFixture<AuthPage>;

  function create(mode: AuthMode, returnUrl?: string): HTMLElement {
    fixture = TestBed.createComponent(AuthPage);
    fixture.componentRef.setInput('mode', mode);
    fixture.componentRef.setInput('returnUrl', returnUrl);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  function type(element: HTMLElement, label: string, value: string): void {
    const field = Array.from(element.querySelectorAll('app-form-field')).find((item) =>
      item.querySelector('label')?.textContent?.includes(label),
    );
    const input = field?.querySelector('input') as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('blur'));
  }

  async function submit(element: HTMLElement): Promise<void> {
    element.querySelector('form')?.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => {
    auth = createAuthStub(null);
    navigate = vi.fn().mockResolvedValue(true);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: auth },
        { provide: THEME_STORAGE, useValue: new MemoryStorage() },
      ],
    });
    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockImplementation(navigate as never);
  });

  it('inicia sesión con el correo recortado y vuelve a la ruta pedida', async () => {
    const element = create('login', '/review');
    type(element, 'Correo', '  ana@correo.com ');
    type(element, 'Contraseña', 'secreta123');

    await submit(element);

    expect(auth.signIn).toHaveBeenCalledWith({ email: 'ana@correo.com', password: 'secreta123' });
    expect(navigate).toHaveBeenCalledWith('/review');
  });

  it('ignora un returnUrl externo y va a /sets', async () => {
    const element = create('login', '//sitio.externo');
    type(element, 'Correo', 'ana@correo.com');
    type(element, 'Contraseña', 'secreta123');

    await submit(element);

    expect(navigate).toHaveBeenCalledWith('/sets');
  });

  it('muestra los errores de campos vacíos sin llamar al servidor', async () => {
    const element = create('login');

    await submit(element);

    expect(element.textContent).toContain('Escribe tu correo electrónico.');
    expect(element.textContent).toContain('Escribe tu contraseña.');
    expect(auth.signIn).not.toHaveBeenCalled();
  });

  it('muestra el mensaje del servidor cuando las credenciales fallan', async () => {
    auth.signIn.mockRejectedValue(new AppError('invalid-credentials'));
    const element = create('login');
    type(element, 'Correo', 'ana@correo.com');
    type(element, 'Contraseña', 'incorrecta');

    await submit(element);

    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      'El correo o la contraseña no son correctos.',
    );
    expect(navigate).not.toHaveBeenCalled();
  });

  it('al iniciar sesión no exige longitud mínima, pero al registrarse sí', async () => {
    const login = create('login');
    type(login, 'Correo', 'ana@correo.com');
    type(login, 'Contraseña', 'corta');
    await submit(login);
    expect(auth.signIn).toHaveBeenCalled();

    const register = create('register');
    type(register, 'Correo', 'ana@correo.com');
    type(register, 'Contraseña', 'corta');
    type(register, 'Repite', 'corta');
    await submit(register);
    expect(register.textContent).toContain('Usa al menos 8 caracteres.');
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  it('no registra si las contraseñas no coinciden', async () => {
    const element = create('register');
    type(element, 'Correo', 'ana@correo.com');
    type(element, 'Contraseña', 'secreta123');
    type(element, 'Repite', 'secreta124');

    await submit(element);

    expect(element.textContent).toContain('Las contraseñas no coinciden.');
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  it('crea la cuenta y entra cuando no hace falta confirmar el correo', async () => {
    const element = create('register');
    type(element, 'Correo', 'ana@correo.com');
    type(element, 'Contraseña', 'secreta123');
    type(element, 'Repite', 'secreta123');

    await submit(element);

    expect(auth.signUp).toHaveBeenCalledWith({ email: 'ana@correo.com', password: 'secreta123' });
    expect(navigate).toHaveBeenCalledWith('/sets');
  });

  it('avisa que hay que confirmar el correo cuando el proyecto lo exige', async () => {
    auth.signUp.mockResolvedValue('confirmation-required');
    const element = create('register');
    type(element, 'Correo', 'ana@correo.com');
    type(element, 'Contraseña', 'secreta123');
    type(element, 'Repite', 'secreta123');

    await submit(element);

    expect(element.textContent).toContain('Revisa tu correo');
    expect(element.textContent).toContain('ana@correo.com');
    expect(navigate).not.toHaveBeenCalled();
  });
});
