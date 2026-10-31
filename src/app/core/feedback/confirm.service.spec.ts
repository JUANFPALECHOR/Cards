import { TestBed } from '@angular/core/testing';
import { ConfirmService } from './confirm.service';

describe('ConfirmService', () => {
  let service: ConfirmService;

  beforeEach(() => {
    service = TestBed.inject(ConfirmService);
  });

  it('expone la solicitud con valores por defecto', () => {
    void service.ask({ title: '¿Continuar?' });

    expect(service.request()).toEqual({
      title: '¿Continuar?',
      message: null,
      confirmLabel: 'Confirmar',
      cancelLabel: 'Cancelar',
      tone: 'default',
    });
  });

  it('resuelve true al confirmar y limpia la solicitud', async () => {
    const answer = service.ask({ title: '¿Eliminar?', tone: 'danger' });

    service.resolve(true);

    await expect(answer).resolves.toBe(true);
    expect(service.request()).toBeNull();
  });

  it('resuelve false al cancelar', async () => {
    const answer = service.ask({ title: '¿Eliminar?' });

    service.resolve(false);

    await expect(answer).resolves.toBe(false);
  });

  it('una nueva solicitud cancela la anterior', async () => {
    const first = service.ask({ title: 'Primera' });
    const second = service.ask({ title: 'Segunda' });

    await expect(first).resolves.toBe(false);
    expect(service.request()?.title).toBe('Segunda');

    service.resolve(true);
    await expect(second).resolves.toBe(true);
  });
});
