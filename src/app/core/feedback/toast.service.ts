import { Injectable, signal } from '@angular/core';

export type ToastKind = 'success' | 'error' | 'info';

export interface Toast {
  readonly id: number;
  readonly kind: ToastKind;
  readonly message: string;
  readonly leaving: boolean;
}

/** Los errores se quedan más tiempo: suelen requerir que el usuario los lea con calma. */
const DURATION_MS: Record<ToastKind, number> = {
  success: 4000,
  info: 4000,
  error: 7000,
};

/** Duración de la animación de salida; debe coincidir con --duration-exit. */
export const TOAST_EXIT_MS = 150;

const MAX_VISIBLE = 3;

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly items = signal<readonly Toast[]>([]);
  private readonly timers = new Map<number, ReturnType<typeof setTimeout>>();
  private nextId = 1;

  readonly toasts = this.items.asReadonly();

  success(message: string): number {
    return this.show('success', message);
  }

  error(message: string): number {
    return this.show('error', message);
  }

  info(message: string): number {
    return this.show('info', message);
  }

  dismiss(id: number): void {
    const toast = this.items().find((item) => item.id === id);
    if (!toast || toast.leaving) return;

    this.clearTimer(id);
    this.items.update((items) =>
      items.map((item) => (item.id === id ? { ...item, leaving: true } : item)),
    );
    setTimeout(
      () => this.items.update((items) => items.filter((item) => item.id !== id)),
      TOAST_EXIT_MS,
    );
  }

  /** Detiene el cierre automático mientras el usuario lee (hover o foco). */
  pause(id: number): void {
    this.clearTimer(id);
  }

  resume(id: number): void {
    const toast = this.items().find((item) => item.id === id);
    if (toast && !toast.leaving && !this.timers.has(id)) {
      this.schedule(toast);
    }
  }

  private show(kind: ToastKind, message: string): number {
    const toast: Toast = { id: this.nextId++, kind, message, leaving: false };
    this.items.update((items) => [...items, toast]);

    const overflow = this.items().filter((item) => !item.leaving).length - MAX_VISIBLE;
    if (overflow > 0) {
      this.items()
        .filter((item) => !item.leaving)
        .slice(0, overflow)
        .forEach((item) => this.dismiss(item.id));
    }

    this.schedule(toast);
    return toast.id;
  }

  private schedule(toast: Toast): void {
    this.timers.set(
      toast.id,
      setTimeout(() => this.dismiss(toast.id), DURATION_MS[toast.kind]),
    );
  }

  private clearTimer(id: number): void {
    clearTimeout(this.timers.get(id));
    this.timers.delete(id);
  }
}
