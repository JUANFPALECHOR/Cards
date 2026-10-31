import { TestBed } from '@angular/core/testing';
import { TOAST_EXIT_MS, ToastService } from './toast.service';

describe('ToastService', () => {
  let service: ToastService;

  beforeEach(() => {
    vi.useFakeTimers();
    service = TestBed.inject(ToastService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('muestra una notificación con su tipo y mensaje', () => {
    service.success('Guardado');

    expect(service.toasts()).toEqual([
      expect.objectContaining({ kind: 'success', message: 'Guardado', leaving: false }),
    ]);
  });

  it('se cierra sola: primero marca la salida y luego la elimina', () => {
    service.info('Hola');

    vi.advanceTimersByTime(4000);
    expect(service.toasts()[0].leaving).toBe(true);

    vi.advanceTimersByTime(TOAST_EXIT_MS);
    expect(service.toasts()).toHaveLength(0);
  });

  it('los errores permanecen más tiempo que los mensajes de éxito', () => {
    service.error('Falló');

    vi.advanceTimersByTime(4000);
    expect(service.toasts()[0].leaving).toBe(false);

    vi.advanceTimersByTime(3000);
    expect(service.toasts()[0].leaving).toBe(true);
  });

  it('pausar evita el cierre automático y reanudar lo vuelve a programar', () => {
    const id = service.info('Leyendo');

    service.pause(id);
    vi.advanceTimersByTime(10_000);
    expect(service.toasts()[0].leaving).toBe(false);

    service.resume(id);
    vi.advanceTimersByTime(4000);
    expect(service.toasts()[0].leaving).toBe(true);
  });

  it('cierra manualmente una notificación', () => {
    const id = service.info('Cerrar');

    service.dismiss(id);
    vi.advanceTimersByTime(TOAST_EXIT_MS);

    expect(service.toasts()).toHaveLength(0);
  });

  it('mantiene como máximo tres notificaciones visibles', () => {
    ['1', '2', '3', '4'].forEach((message) => service.info(message));

    const visible = service.toasts().filter((toast) => !toast.leaving);
    expect(visible.map((toast) => toast.message)).toEqual(['2', '3', '4']);
  });
});
