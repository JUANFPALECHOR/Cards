import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth/auth.guard';

const pageTitle = (title: string): string => `${title} · English Learning`;

/**
 * Catálogo visual del sistema de diseño: solo en desarrollo.
 * `ngDevMode` es una constante que el compilador reemplaza por `false` en producción,
 * así que la ruta y su chunk se eliminan del build final.
 */
const devRoutes: Routes =
  typeof ngDevMode !== 'undefined' && ngDevMode
    ? [
        {
          path: 'design-system',
          title: pageTitle('Sistema de diseño'),
          loadComponent: () =>
            import('./dev/design-system-page/design-system-page').then((m) => m.DesignSystemPage),
        },
      ]
    : [];

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'sets' },
  {
    path: 'login',
    title: pageTitle('Iniciar sesión'),
    canActivate: [guestGuard],
    data: { mode: 'login' },
    loadComponent: () =>
      import('./features/auth/pages/auth-page/auth-page').then((m) => m.AuthPage),
  },
  {
    path: 'registro',
    title: pageTitle('Crear cuenta'),
    canActivate: [guestGuard],
    data: { mode: 'register' },
    loadComponent: () =>
      import('./features/auth/pages/auth-page/auth-page').then((m) => m.AuthPage),
  },
  {
    path: '',
    canActivate: [authGuard],
    children: [
      {
        path: 'sets',
        title: pageTitle('Mis conjuntos'),
        loadComponent: () =>
          import('./features/study-sets/pages/study-sets-page/study-sets-page').then(
            (m) => m.StudySetsPage,
          ),
      },
      // El título real (nombre del conjunto) lo fija cada página al cargar los datos.
      {
        path: 'sets/:setId',
        title: pageTitle('Conjunto'),
        loadComponent: () =>
          import('./features/study-sets/pages/study-set-detail-page/study-set-detail-page').then(
            (m) => m.StudySetDetailPage,
          ),
      },
      {
        path: 'sets/:setId/flashcards',
        title: pageTitle('Flashcards'),
        loadComponent: () =>
          import('./features/flashcards/pages/flashcards-page/flashcards-page').then(
            (m) => m.FlashcardsPage,
          ),
      },
      {
        path: 'sets/:setId/quiz',
        title: pageTitle('Cuestionario'),
        loadComponent: () =>
          import('./features/quizzes/pages/quiz-page/quiz-page').then((m) => m.QuizPage),
      },
      {
        path: 'review',
        title: pageTitle('Repasar'),
        loadComponent: () =>
          import('./features/spaced-repetition/pages/review-page/review-page').then(
            (m) => m.ReviewPage,
          ),
      },
      {
        path: 'progress',
        title: pageTitle('Progreso'),
        loadComponent: () =>
          import('./features/progress/pages/progress-page/progress-page').then(
            (m) => m.ProgressPage,
          ),
      },
    ],
  },
  ...devRoutes,
  {
    path: '**',
    title: pageTitle('Página no encontrada'),
    loadComponent: () => import('./features/not-found/not-found-page').then((m) => m.NotFoundPage),
  },
];
