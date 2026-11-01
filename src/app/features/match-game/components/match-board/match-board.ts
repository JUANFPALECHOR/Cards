import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Board } from '../../domain/match-game';

export type Side = 'term' | 'translation';
export type Selection = Partial<Record<Side, number>>;

/** Tablero de dos columnas (inglés · español) pensado para pantallas táctiles. */
@Component({
  selector: 'app-match-board',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './match-board.scss',
  template: `
    <div class="board">
      <div class="column" role="group" aria-label="Inglés">
        @for (tile of board().terms; track tile.key; let i = $index) {
          <button
            type="button"
            class="tile"
            lang="en"
            [class.is-selected]="selected().term === i"
            [class.is-wrong]="wrong()?.term === i"
            [attr.aria-pressed]="selected().term === i"
            (click)="picked.emit({ side: 'term', index: i })"
          >
            {{ tile.pair.term }}
          </button>
        }
      </div>
      <div class="column" role="group" aria-label="Español">
        @for (tile of board().translations; track tile.key; let i = $index) {
          <button
            type="button"
            class="tile is-translation"
            lang="es"
            [class.is-selected]="selected().translation === i"
            [class.is-wrong]="wrong()?.translation === i"
            [attr.aria-pressed]="selected().translation === i"
            (click)="picked.emit({ side: 'translation', index: i })"
          >
            {{ tile.pair.translation }}
          </button>
        }
      </div>
    </div>
  `,
})
export class MatchBoard {
  readonly board = input.required<Board>();
  readonly selected = input<Selection>({});
  readonly wrong = input<Selection | null>(null);
  readonly picked = output<{ side: Side; index: number }>();
}
