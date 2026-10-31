import { TestBed } from '@angular/core/testing';
import { AuthService } from '../../../core/auth/auth.service';
import { createAuthStub } from '../../../../testing/auth-stub';
import { StudySetsRepository } from '../data/study-sets.repository';
import { StudySet } from '../models/study-set';
import { StudySetsStore } from './study-sets.store';

function makeSet(id: string, updatedAt: string, wordCount = 0): StudySet {
  return { id, name: `Set ${id}`, description: null, wordCount, createdAt: updatedAt, updatedAt };
}

describe('StudySetsStore', () => {
  let repository: {
    list: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };
  let auth: ReturnType<typeof createAuthStub>;
  let store: StudySetsStore;

  beforeEach(() => {
    auth = createAuthStub('user-1');
    repository = { list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        { provide: StudySetsRepository, useValue: repository },
        { provide: AuthService, useValue: auth },
      ],
    });
    store = TestBed.inject(StudySetsStore);
  });

  it('carga los conjuntos y comparte la petición si se pide dos veces a la vez', async () => {
    repository.list.mockResolvedValue([makeSet('a', '2026-10-02')]);

    await Promise.all([store.load(), store.load()]);

    expect(repository.list).toHaveBeenCalledTimes(1);
    expect(store.status()).toBe('ready');
    expect(store.sets().map((set) => set.id)).toEqual(['a']);
  });

  it('muestra un error si la primera carga falla', async () => {
    repository.list.mockRejectedValue({ code: 'XX000' });

    await store.load();

    expect(store.status()).toBe('error');
    expect(store.error()).toMatch(/inesperado/);
  });

  it('conserva los datos anteriores si falla una recarga', async () => {
    repository.list.mockResolvedValueOnce([makeSet('a', '2026-10-02')]);
    await store.load();
    repository.list.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await store.load();

    expect(store.status()).toBe('ready');
    expect(store.sets()).toHaveLength(1);
    expect(store.error()).toMatch(/conectar/);
  });

  it('agrega, actualiza (reordenando por fecha) y elimina conjuntos', async () => {
    repository.list.mockResolvedValue([makeSet('a', '2026-10-02'), makeSet('b', '2026-10-01')]);
    await store.load();

    repository.create.mockResolvedValue(makeSet('c', '2026-10-03'));
    await store.create({ name: 'Set c', description: null });
    expect(store.sets().map((set) => set.id)).toEqual(['c', 'a', 'b']);

    repository.update.mockResolvedValue(makeSet('b', '2026-10-04'));
    await store.update('b', { name: 'Set b', description: null });
    expect(store.sets().map((set) => set.id)).toEqual(['b', 'c', 'a']);

    repository.remove.mockResolvedValue(undefined);
    await store.remove('c');
    expect(store.sets().map((set) => set.id)).toEqual(['b', 'a']);
  });

  it('actualiza el contador de palabras de un conjunto', async () => {
    repository.list.mockResolvedValue([makeSet('a', '2026-10-02', 3)]);
    await store.load();

    store.setWordCount('a', 4);

    expect(store.sets()[0].wordCount).toBe(4);
  });

  it('descarta los datos en memoria cuando cambia el usuario', async () => {
    repository.list.mockResolvedValue([makeSet('a', '2026-10-02')]);
    await store.load();
    TestBed.tick();
    expect(store.sets()).toHaveLength(1);

    auth.userId.set(null);
    TestBed.tick();

    expect(store.sets()).toEqual([]);
    expect(store.status()).toBe('idle');
  });
});
