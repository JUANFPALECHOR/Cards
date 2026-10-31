import { PronunciationButtons } from '../../../pronunciation/components/pronunciation-buttons/pronunciation-buttons';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  booleanAttribute,
  computed,
  input,
  output,
  viewChild,
} from '@angular/core';

/**
 * Tarjeta que gira para revelar la respuesta.
 * Es un <button>: se activa con clic, toque, Enter o Espacio. La cara oculta queda fuera
 * del árbol de accesibilidad y la respuesta se anuncia en una región aria-live al girar.
 * El audio va fuera del botón (no se anidan controles) y solo aparece con la cara en inglés
 * visible: en ES→EN escucharlo antes de girar revelaría la respuesta.
 */
@Component({
  selector: 'app-flashcard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PronunciationButtons],
  host: { '[class.has-audio]': 'audio()' },
  styleUrl: './flashcard.scss',
  template: `
    <button
      #button
      type="button"
      class="scene"
      [class.is-flipped]="flipped()"
      [attr.data-instant]="instant() ? '' : null"
      (click)="onClick($event)"
    >
      <span class="inner">
        <span class="face front" [attr.aria-hidden]="flipped()">
          @if (context(); as text) {
            <span class="context">{{ text }}</span>
          }
          <span class="label">{{ promptLabel() }}</span>
          <span class="text text-card" [attr.lang]="promptLang()">{{ prompt() }}</span>
          @if (promptLang() === 'en' && pronunciation(); as text) {
            <span class="pronunciation" lang="es">
              <span class="sr-only">Pronunciación aproximada: </span>{{ text }}
            </span>
          }
          <span class="hint">Toca o haz clic para ver la respuesta</span>
        </span>
        <span class="face back" [attr.aria-hidden]="!flipped()">
          <span class="label">{{ answerLabel() }}</span>
          <span class="text text-card" [attr.lang]="answerLang()">{{ answer() }}</span>
          @if (answerLang() === 'en' && pronunciation(); as text) {
            <span class="pronunciation" lang="es">
              <span class="sr-only">Pronunciación aproximada: </span>{{ text }}
            </span>
          }
          @if (example(); as sentence) {
            <span class="example" lang="en">“{{ sentence }}”</span>
          }
        </span>
      </span>
    </button>
    @if (audio(); as source) {
      <div class="audio" [attr.data-instant]="instant() ? '' : null">
        <app-pronunciation-buttons [itemId]="source.itemId" [term]="source.term" />
      </div>
    }
    <p class="sr-only" aria-live="polite">{{ flipped() ? 'Respuesta: ' + answer() : '' }}</p>
  `,
})
export class Flashcard {
  readonly prompt = input.required<string>();
  readonly answer = input.required<string>();
  readonly promptLang = input.required<'en' | 'es'>();
  readonly answerLang = input.required<'en' | 'es'>();
  readonly promptLabel = input.required<string>();
  readonly answerLabel = input.required<string>();
  readonly example = input<string | null>(null);
  readonly context = input<string | null>(null);
  /** Palabra a la que pertenece el audio; sin ella no se muestran los botones. */
  readonly itemId = input<string | null>(null);
  /** Término en inglés (el que se pronuncia). */
  readonly term = input<string | null>(null);
  readonly pronunciation = input<string | null>(null);
  readonly flipped = input(false, { transform: booleanAttribute });
  /** Giro sin animación (acciones de teclado: se repiten mucho y no deben esperar). */
  readonly instant = input(false, { transform: booleanAttribute });

  protected readonly audio = computed(() => {
    const itemId = this.itemId();
    const term = this.term();
    const englishVisible = this.promptLang() === 'en' || this.flipped();
    return itemId && term && englishVisible ? { itemId, term } : null;
  });

  /** `true` si el giro se pidió desde el teclado. */
  readonly toggle = output<boolean>();

  private readonly button = viewChild.required<ElementRef<HTMLButtonElement>>('button');

  focus(): void {
    this.button().nativeElement.focus();
  }

  protected onClick(event: MouseEvent): void {
    // detail === 0: el "clic" lo generó el teclado (Enter/Espacio), no un puntero.
    this.toggle.emit(event.detail === 0);
  }
}
