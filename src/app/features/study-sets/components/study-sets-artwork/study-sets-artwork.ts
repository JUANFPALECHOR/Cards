import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Ilustración puramente decorativa, construida con CSS y los colores del tema. */
@Component({
  selector: 'app-study-sets-artwork',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
  styleUrl: './study-sets-artwork.scss',
  template: `
    <span class="orbit orbit-back"></span>
    <span class="floating-card card-peach"></span>
    <span class="floating-card card-lilac"></span>
    <span class="floating-card card-front">Aa</span>
    <span class="orbit orbit-front"></span>
  `,
})
export class StudySetsArtwork {}
