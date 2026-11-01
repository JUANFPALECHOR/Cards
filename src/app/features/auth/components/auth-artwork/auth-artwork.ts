import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Icon } from '../../../../shared/ui/atoms/icon/icon';

@Component({
  selector: 'app-auth-artwork',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  styleUrl: './auth-artwork.scss',
  template: `
    <div class="intro">
      <h2 lang="en">English <span>Learning</span></h2>
      <span class="accent" aria-hidden="true"></span>
      <p>Estudia, repasa y domina vocabulario en inglés.</p>
    </div>
    <ul class="benefits" aria-label="Aprende a tu ritmo">
      <li>
        <span class="benefit-icon"><app-icon name="bolt" [size]="31" /></span
        ><span>Repasa de forma<br />inteligente</span>
      </li>
      <li>
        <span class="benefit-icon"><app-icon name="chart" [size]="31" /></span
        ><span>Sigue tu progreso<br />real</span>
      </li>
      <li>
        <span class="benefit-icon"><app-icon name="target" [size]="31" /></span
        ><span>Domina el vocabulario<br />que más te cuesta</span>
      </li>
    </ul>
    <div class="mascot" aria-hidden="true">
      <span class="mascot-blob"></span>
      <span class="rays"><i></i><i></i><i></i></span>
      <img
        src="/images/login-cat.png"
        width="1206"
        height="1305"
        alt=""
        fetchpriority="high"
        decoding="async"
        draggable="false"
      />
    </div>
  `,
})
export class AuthArtwork {}
