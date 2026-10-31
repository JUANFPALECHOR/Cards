import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
} from '@angular/core';
import { Icon } from '../../../../shared/ui/atoms/icon/icon';
import { Spinner } from '../../../../shared/ui/atoms/spinner/spinner';
import {
  PlaybackRate,
  PronunciationPlayer,
  pronunciationKey,
} from '../../state/pronunciation-player';

/** Botones de pronunciación: velocidad normal (1×) y lenta (0,75×). Pulsar de nuevo detiene. */
@Component({
  selector: 'app-pronunciation-buttons',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, Spinner],
  host: {
    role: 'group',
    '[attr.aria-label]': '"Pronunciación de «" + term() + "»"',
  },
  styleUrl: './pronunciation-buttons.scss',
  template: `
    <button
      type="button"
      class="btn"
      [class.is-active]="normal()"
      [attr.aria-label]="normal() ? 'Detener «' + term() + '»' : 'Escuchar «' + term() + '»'"
      [attr.aria-busy]="normal() === 'loading' || null"
      [title]="normal() ? 'Detener' : 'Escuchar'"
      (click)="toggle(1)"
    >
      @switch (normal()) {
        @case ('loading') {
          <app-spinner [size]="14" />
        }
        @case ('playing') {
          <app-icon name="stop" [size]="16" />
        }
        @default {
          <app-icon name="volume" [size]="18" />
        }
      }
    </button>
    <button
      type="button"
      class="btn"
      [class.is-active]="slow()"
      [attr.aria-label]="
        slow() ? 'Detener «' + term() + '»' : 'Escuchar «' + term() + '» a velocidad lenta'
      "
      [attr.aria-busy]="slow() === 'loading' || null"
      [title]="slow() ? 'Detener' : 'Escuchar lento (0,75×)'"
      (click)="toggle(0.75)"
    >
      @switch (slow()) {
        @case ('loading') {
          <app-spinner [size]="14" />
        }
        @case ('playing') {
          <app-icon name="stop" [size]="16" />
        }
        @default {
          <span class="rate" aria-hidden="true">0,75×</span>
        }
      }
    </button>
  `,
})
export class PronunciationButtons {
  readonly itemId = input.required<string>();
  /** Texto en inglés tal como está guardado (identifica la versión del audio). */
  readonly term = input.required<string>();

  private readonly player = inject(PronunciationPlayer);
  private readonly key = computed(() => pronunciationKey(this.itemId(), this.term()));

  protected readonly normal = computed(() => this.phaseFor(1));
  protected readonly slow = computed(() => this.phaseFor(0.75));

  constructor() {
    inject(DestroyRef).onDestroy(() => this.player.stopIfCurrent(this.itemId(), this.term()));
  }

  protected toggle(rate: PlaybackRate): void {
    void this.player.toggle(this.itemId(), this.term(), rate);
  }

  private phaseFor(rate: PlaybackRate): 'loading' | 'playing' | null {
    const state = this.player.state();
    return state?.key === this.key() && state.rate === rate ? state.phase : null;
  }
}
