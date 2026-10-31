import { InjectionToken } from '@angular/core';
import { DEFAULT_LEARNING_CONFIG, LearningConfig } from './domain/learning-config';

/** Configuración activa del aprendizaje adaptativo. Para ajustarla basta con proveer otra. */
export const LEARNING_CONFIG = new InjectionToken<LearningConfig>('LEARNING_CONFIG', {
  providedIn: 'root',
  factory: () => DEFAULT_LEARNING_CONFIG,
});
