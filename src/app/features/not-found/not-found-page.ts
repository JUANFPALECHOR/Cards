import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EmptyState } from '../../shared/ui/molecules/empty-state/empty-state';
import { Button } from '../../shared/ui/atoms/button/button';

@Component({
  selector: 'app-not-found-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, EmptyState, Button],
  template: `
    <h1 class="sr-only">Página no encontrada</h1>
    <app-empty-state
      icon="search"
      title="No encontramos esta página"
      description="Puede que el enlace sea incorrecto o que el contenido ya no exista."
    >
      <a appButton routerLink="/sets">Ir a mis conjuntos</a>
    </app-empty-state>
  `,
})
export class NotFoundPage {}
