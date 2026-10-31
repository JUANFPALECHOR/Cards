import { computed, signal } from '@angular/core';

/** Doble de AuthService para pruebas: `userId` es un signal que la prueba puede cambiar. */
export function createAuthStub(initialUserId: string | null = 'user-1') {
  const userId = signal<string | null>(initialUserId);
  return {
    userId,
    email: computed(() => (userId() ? 'ana@correo.com' : null)),
    status: computed(() => (userId() ? 'signed-in' : 'signed-out')),
    initialize: vi.fn().mockResolvedValue(undefined),
    signIn: vi.fn().mockResolvedValue(undefined),
    signUp: vi.fn().mockResolvedValue('signed-in'),
    signOut: vi.fn().mockResolvedValue(undefined),
  };
}
