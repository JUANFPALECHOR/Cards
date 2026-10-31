import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { Badge, BadgeTone } from '../../../../shared/ui/atoms/badge/badge';
import { Icon } from '../../../../shared/ui/atoms/icon/icon';
import { IconButton } from '../../../../shared/ui/atoms/icon-button/icon-button';
import { PronunciationButtons } from '../../../pronunciation/components/pronunciation-buttons/pronunciation-buttons';
import {
  LEARNING_STATUS_SHORT_LABELS,
  LearningStatus,
  describeStatus,
} from '../../../spaced-repetition/domain/learning-state';
import { LEARNING_CONFIG } from '../../../spaced-repetition/srs-algorithm';
import { VocabularyItem } from '../../models/vocabulary-item';

const STATUS_TONES: Record<LearningStatus, BadgeTone> = {
  new: 'neutral',
  learning: 'warning',
  difficult: 'danger',
  provisional: 'info',
  learned: 'success',
};

@Component({
  selector: 'app-vocabulary-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Badge, Icon, IconButton, PronunciationButtons],
  styleUrl: './vocabulary-row.scss',
  template: `
    <div class="main">
      <div class="term-line">
        <p class="term" lang="en">{{ item().term }}</p>
        <app-pronunciation-buttons [itemId]="item().id" [term]="item().term" />
      </div>
      @if (item().pronunciation; as pronunciation) {
        <p class="pronunciation" lang="es">
          <span class="sr-only">Pronunciación aproximada: </span>{{ pronunciation }}
        </p>
      }
      <p class="translation" lang="es">{{ item().translation }}</p>
      @if (item().example; as example) {
        <p class="example" lang="en">“{{ example }}”</p>
      }
      @if (item().notes; as notes) {
        <p class="notes"><span class="notes-label">Nota:</span> {{ notes }}</p>
      }
    </div>
    <div class="side">
      <app-badge [tone]="statusTone()" [attr.title]="statusReason()">
        {{ statusLabel() }}<span class="sr-only">. {{ statusReason() }}</span>
      </app-badge>
      <div class="actions">
        <button
          appIconButton
          size="sm"
          [label]="'Editar «' + item().term + '»'"
          (click)="edit.emit()"
        >
          <app-icon name="edit" [size]="16" />
        </button>
        <button
          appIconButton
          size="sm"
          class="danger"
          [label]="'Eliminar «' + item().term + '»'"
          (click)="remove.emit()"
        >
          <app-icon name="trash" [size]="16" />
        </button>
      </div>
    </div>
  `,
})
export class VocabularyRow {
  readonly item = input.required<VocabularyItem>();
  readonly edit = output<void>();
  readonly remove = output<void>();

  private readonly config = inject(LEARNING_CONFIG);

  protected readonly statusLabel = computed(() => LEARNING_STATUS_SHORT_LABELS[this.item().status]);
  protected readonly statusTone = computed(() => STATUS_TONES[this.item().status]);
  /** Por qué está en ese estado (texto alternativo y descripción emergente). */
  protected readonly statusReason = computed(() =>
    describeStatus(this.item().learning, this.config),
  );
}
