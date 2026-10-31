import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Decoración de la portada. No participa en el foco ni intercepta las acciones de estudio. */
@Component({
  selector: 'app-study-sets-backdrop',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
  styleUrl: './study-sets-backdrop.scss',
  template: `
    <span class="ribbon ribbon-upper"></span>
    <span class="ribbon ribbon-middle"></span>
    <span class="ribbon ribbon-lower"></span>
    <span class="accent accent-upper"></span>
    <span class="accent accent-lower"></span>
    <span class="cat"></span>
  `,
})
export class StudySetsBackdrop {}
