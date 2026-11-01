import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { toAppError } from '../../../../core/supabase/app-error';
import { Button } from '../../../../shared/ui/atoms/button/button';
import { Icon } from '../../../../shared/ui/atoms/icon/icon';
import { Skeleton } from '../../../../shared/ui/atoms/skeleton/skeleton';
import { EmptyState } from '../../../../shared/ui/molecules/empty-state/empty-state';
import { ProgressBar } from '../../../../shared/ui/molecules/progress-bar/progress-bar';
import { MatchBoard, Selection, Side } from '../../components/match-board/match-board';
import { LearningRepository } from '../../../spaced-repetition/data/learning.repository';
import {
  BOARD_SIZE,
  Board,
  ERROR_PENALTY_POINTS,
  ERROR_PENALTY_SECONDS,
  MatchPair,
  POINTS_PER_SECOND_LEFT,
  PairDeck,
  checkpointFor,
  playablePairs,
  pointsFor,
} from '../../domain/match-game';

type PageStatus = 'loading' | 'ready' | 'error';
type Phase = 'intro' | 'playing' | 'cleared' | 'over';

const WRONG_FEEDBACK_MS = 450;

/**
 * Juego de emparejar con el vocabulario del usuario. Es práctica de velocidad: no registra
 * intentos en el aprendizaje (emparejar por descarte no demuestra que recuerdes la palabra).
 */
@Component({
  selector: 'app-match-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Button, Icon, Skeleton, EmptyState, ProgressBar, MatchBoard],
  templateUrl: './match-page.html',
  styleUrl: './match-page.scss',
})
export class MatchPage {
  private readonly learning = inject(LearningRepository);

  protected readonly status = signal<PageStatus>('loading');
  protected readonly error = signal<string | null>(null);
  protected readonly pairs = signal<readonly MatchPair[]>([]);
  protected readonly minPairs = BOARD_SIZE;
  protected readonly penalty = { seconds: ERROR_PENALTY_SECONDS, points: ERROR_PENALTY_POINTS };
  protected readonly preview = [1, 2, 3].map(checkpointFor);

  protected readonly phase = signal<Phase>('intro');
  protected readonly level = signal(1);
  protected readonly checkpoint = computed(() => checkpointFor(this.level()));
  protected readonly nextCheckpoint = computed(() => checkpointFor(this.level() + 1));
  protected readonly board = signal<Board | null>(null);
  protected readonly selected = signal<Selection>({});
  protected readonly wrong = signal<Selection | null>(null);

  protected readonly matched = signal(0);
  protected readonly totalMatched = signal(0);
  protected readonly errors = signal(0);
  protected readonly score = signal(0);
  protected readonly combo = signal(0);
  protected readonly lastBonus = signal(0);
  protected readonly remainingMs = signal(0);

  protected readonly secondsLeft = computed(() => Math.ceil(this.remainingMs() / 1000));
  protected readonly timeLabel = computed(() => formatClock(this.secondsLeft()));
  protected readonly lowTime = computed(() => this.secondsLeft() <= 10);
  protected readonly accuracy = computed(() => {
    const attempts = this.totalMatched() + this.errors();
    return attempts === 0 ? 0 : Math.round((100 * this.totalMatched()) / attempts);
  });

  private deck: PairDeck | null = null;
  private deadline = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private pausedLeft: number | null = null;
  private wrongTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    void this.load();
    // Si la pestaña o la app pasan a segundo plano, el reloj se detiene.
    const onVisibility = () => (document.hidden ? this.pause() : this.resume());
    document.addEventListener('visibilitychange', onVisibility);
    inject(DestroyRef).onDestroy(() => {
      document.removeEventListener('visibilitychange', onVisibility);
      this.stopTimer();
      if (this.wrongTimeout) clearTimeout(this.wrongTimeout);
    });
  }

  protected reload(): void {
    void this.load();
  }

  protected formatClock(seconds: number): string {
    return formatClock(seconds);
  }

  protected startGame(): void {
    this.deck = new PairDeck(this.pairs());
    this.level.set(1);
    this.totalMatched.set(0);
    this.errors.set(0);
    this.score.set(0);
    this.startCheckpoint();
  }

  protected continueGame(): void {
    this.level.update((level) => level + 1);
    this.startCheckpoint();
  }

  protected pick(side: Side, index: number): void {
    if (this.phase() !== 'playing') return;
    const current = this.selected();
    const next = { ...current, [side]: current[side] === index ? undefined : index };
    if (next.term === undefined || next.translation === undefined) {
      this.selected.set(next);
      return;
    }
    this.selected.set({});
    this.evaluate(next.term, next.translation);
  }

  private evaluate(termIndex: number, translationIndex: number): void {
    const board = this.board()!;
    if (board.terms[termIndex].pair.id === board.translations[translationIndex].pair.id) {
      const combo = this.combo() + 1;
      this.combo.set(combo);
      this.score.update((score) => score + pointsFor(combo));
      this.matched.update((count) => count + 1);
      this.totalMatched.update((count) => count + 1);
      this.board.set(this.deck!.replace(board, termIndex, translationIndex));
      if (this.matched() >= this.checkpoint().target) this.clearCheckpoint();
      return;
    }
    this.errors.update((count) => count + 1);
    this.combo.set(0);
    this.score.update((score) => Math.max(0, score - ERROR_PENALTY_POINTS));
    this.deadline -= ERROR_PENALTY_SECONDS * 1000;
    this.tick();
    this.wrong.set({ term: termIndex, translation: translationIndex });
    if (this.wrongTimeout) clearTimeout(this.wrongTimeout);
    this.wrongTimeout = setTimeout(() => this.wrong.set(null), WRONG_FEEDBACK_MS);
  }

  private startCheckpoint(): void {
    this.board.set(this.deck!.deal());
    this.selected.set({});
    this.wrong.set(null);
    this.matched.set(0);
    this.combo.set(0);
    this.phase.set('playing');
    this.startTimer(this.checkpoint().seconds * 1000);
  }

  private clearCheckpoint(): void {
    this.stopTimer();
    const bonus = this.secondsLeft() * POINTS_PER_SECOND_LEFT;
    this.lastBonus.set(bonus);
    this.score.update((score) => score + bonus);
    this.phase.set('cleared');
  }

  private startTimer(ms: number): void {
    this.stopTimer();
    this.pausedLeft = null;
    this.deadline = performance.now() + ms;
    this.tick();
    this.timer = setInterval(() => this.tick(), 100);
  }

  private stopTimer(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private tick(): void {
    const left = Math.max(0, this.deadline - performance.now());
    this.remainingMs.set(left);
    if (left === 0 && this.phase() === 'playing') {
      this.stopTimer();
      this.selected.set({});
      this.phase.set('over');
    }
  }

  private pause(): void {
    if (this.phase() !== 'playing' || !this.timer) return;
    this.pausedLeft = Math.max(0, this.deadline - performance.now());
    this.stopTimer();
  }

  private resume(): void {
    if (this.phase() !== 'playing' || this.pausedLeft === null) return;
    this.startTimer(this.pausedLeft);
  }

  private async load(): Promise<void> {
    this.status.set('loading');
    this.error.set(null);
    try {
      const words = await this.learning.getWords();
      this.pairs.set(
        playablePairs(
          words.map((word) => ({
            id: word.itemId,
            term: word.term,
            translation: word.translation,
          })),
        ),
      );
      this.status.set('ready');
    } catch (error) {
      this.error.set(toAppError(error).message);
      this.status.set('error');
    }
  }
}

function formatClock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
