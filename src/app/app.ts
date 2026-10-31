import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AppShell } from './shared/layouts/app-shell/app-shell';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AppShell],
  template: `<app-shell />`,
})
export class App {}
