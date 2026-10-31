import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ThemeService } from '../../../../core/theme/theme.service';
import { Icon } from '../../atoms/icon/icon';
import { IconButton } from '../../atoms/icon-button/icon-button';

@Component({
  selector: 'app-theme-toggle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, IconButton],
  styleUrl: './theme-toggle.scss',
  template: `
    <button appIconButton [label]="label()" [attr.data-theme-current]="theme()" (click)="toggle()">
      <span class="icons">
        <app-icon class="icon icon-sun" name="sun" />
        <app-icon class="icon icon-moon" name="moon" />
      </span>
    </button>
  `,
})
export class ThemeToggle {
  private readonly themeService = inject(ThemeService);

  protected readonly theme = this.themeService.theme;
  protected readonly label = computed(() =>
    this.theme() === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro',
  );

  protected toggle(): void {
    this.themeService.toggle();
  }
}
