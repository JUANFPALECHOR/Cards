import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Encabezado de página: título (h1), descripción y acciones proyectadas. */
@Component({
  selector: 'app-page-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      justify-content: space-between;
      gap: var(--space-4) var(--space-6);
      margin-bottom: var(--space-8);
    }
    .text {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      min-width: min(100%, 18rem);
      flex: 1 1 auto;
    }
    .description {
      max-width: 60ch;
      color: var(--color-text-muted);
    }
    .actions:empty {
      display: none;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-3);
    }
  `,
  template: `
    <div class="text">
      <h1>{{ title() }}</h1>
      @if (description(); as text) {
        <p class="description">{{ text }}</p>
      }
    </div>
    <div class="actions"><ng-content /></div>
  `,
})
export class PageHeader {
  readonly title = input.required<string>();
  readonly description = input<string | null>(null);
}
