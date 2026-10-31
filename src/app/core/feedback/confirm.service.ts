import { Injectable, signal } from '@angular/core';

export interface ConfirmOptions {
  readonly title: string;
  readonly message?: string;
  readonly confirmLabel?: string;
  readonly cancelLabel?: string;
  /** `danger` para acciones destructivas (eliminar). */
  readonly tone?: 'default' | 'danger';
}

export interface ConfirmRequest extends Required<Omit<ConfirmOptions, 'message'>> {
  readonly message: string | null;
}

/**
 * Sustituto accesible de window.confirm(). Lo renderiza el organismo ConfirmDialog del layout.
 * Uso: `if (await confirm.ask({ title: '¿Eliminar…?', tone: 'danger' })) { … }`
 */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly current = signal<ConfirmRequest | null>(null);
  private resolver: ((confirmed: boolean) => void) | null = null;

  readonly request = this.current.asReadonly();

  ask(options: ConfirmOptions): Promise<boolean> {
    // Una sola confirmación a la vez: la anterior se considera cancelada.
    this.resolve(false);

    this.current.set({
      title: options.title,
      message: options.message ?? null,
      confirmLabel: options.confirmLabel ?? 'Confirmar',
      cancelLabel: options.cancelLabel ?? 'Cancelar',
      tone: options.tone ?? 'default',
    });

    return new Promise<boolean>((resolve) => (this.resolver = resolve));
  }

  resolve(confirmed: boolean): void {
    const resolver = this.resolver;
    this.resolver = null;
    this.current.set(null);
    resolver?.(confirmed);
  }
}
