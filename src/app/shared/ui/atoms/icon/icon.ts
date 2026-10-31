import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type IconName =
  | 'stack'
  | 'repeat'
  | 'chart'
  | 'sun'
  | 'moon'
  | 'search'
  | 'close'
  | 'plus'
  | 'check'
  | 'alert'
  | 'info'
  | 'edit'
  | 'trash'
  | 'arrow-left'
  | 'cards'
  | 'quiz'
  | 'flame'
  | 'target'
  | 'clock'
  | 'book'
  | 'logout'
  | 'mail'
  | 'volume'
  | 'stop'
  | 'calendar'
  | 'chevron-down'
  | 'chevron-left'
  | 'chevron-right'
  | 'brain'
  | 'languages'
  | 'bulb'
  | 'check-circle'
  | 'more-vertical'
  | 'play'
  | 'wave'
  | 'star';

/**
 * Iconos SVG inline (trazo de 24px, sin dependencias). Decorativos por defecto:
 * el control que los contiene debe aportar el nombre accesible.
 */
@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'aria-hidden': 'true',
    '[style.width.px]': 'size()',
    '[style.height.px]': 'size()',
  },
  styles: `
    :host {
      display: inline-flex;
      flex-shrink: 0;
    }
    svg {
      width: 100%;
      height: 100%;
    }
  `,
  template: `
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      focusable="false"
    >
      @switch (name()) {
        @case ('stack') {
          <rect x="3" y="8" width="13" height="13" rx="3" />
          <path d="M8 4h9a3 3 0 0 1 3 3v9" />
        }
        @case ('repeat') {
          <path d="M20 12a8 8 0 0 1-14 5.3" />
          <path d="M4 12a8 8 0 0 1 14-5.3" />
          <path d="M18 3v4h-4" />
          <path d="M6 21v-4h4" />
        }
        @case ('chart') {
          <path d="M5 20v-6" />
          <path d="M12 20V5" />
          <path d="M19 20v-10" />
        }
        @case ('sun') {
          <circle cx="12" cy="12" r="4" />
          <path
            d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
          />
        }
        @case ('moon') {
          <path d="M20.5 14.1A8.5 8.5 0 1 1 9.9 3.5a6.6 6.6 0 0 0 10.6 10.6z" />
        }
        @case ('search') {
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.9-3.9" />
        }
        @case ('close') {
          <path d="M18 6L6 18M6 6l12 12" />
        }
        @case ('plus') {
          <path d="M12 5v14M5 12h14" />
        }
        @case ('check') {
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        }
        @case ('alert') {
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7.5v5.5M12 16.5h.01" />
        }
        @case ('info') {
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5.5M12 7.5h.01" />
        }
        @case ('edit') {
          <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z" />
          <path d="M13.5 6.5l4 4" />
        }
        @case ('trash') {
          <path d="M4 7h16" />
          <path d="M10 11v6M14 11v6" />
          <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
          <path d="M9 7V4h6v3" />
        }
        @case ('arrow-left') {
          <path d="M19 12H5" />
          <path d="M11 18l-6-6 6-6" />
        }
        @case ('cards') {
          <rect x="8" y="3" width="13" height="15" rx="2.5" />
          <path d="M4 7.5V18a3 3 0 0 0 3 3h9" />
        }
        @case ('quiz') {
          <path d="M3.5 6.5L5 8l3-3" />
          <path d="M3.5 13.5L5 15l3-3" />
          <path d="M12 6.5h8.5M12 13.5h8.5M4 20h16.5" />
        }
        @case ('flame') {
          <path
            d="M12 22c4 0 7-2.7 7-6.8 0-3.6-2.5-6-4.5-8.2-.4 2-1.5 3.3-3 3.8C12 7.5 10.5 4.5 8 2.5 8 6.5 5 9 5 15.2 5 19.3 8 22 12 22z"
          />
        }
        @case ('target') {
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="5" />
          <circle cx="12" cy="12" r="1" />
        }
        @case ('clock') {
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        }
        @case ('book') {
          <path d="M4 19V5a2 2 0 0 1 2-2h14v14H6a2 2 0 0 0-2 2z" />
          <path d="M4 19a2 2 0 0 0 2 2h14" />
        }
        @case ('logout') {
          <path d="M9 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3" />
          <path d="M16 17l5-5-5-5" />
          <path d="M21 12H9" />
        }
        @case ('mail') {
          <rect x="3" y="5" width="18" height="14" rx="3" />
          <path d="M4 7l8 6 8-6" />
        }
        @case ('volume') {
          <path d="M4 9.5v5h3.5L12 19V5L7.5 9.5H4z" />
          <path d="M15.5 9a4.2 4.2 0 0 1 0 6" />
          <path d="M18.5 6.5a8 8 0 0 1 0 11" />
        }
        @case ('stop') {
          <rect x="7" y="7" width="10" height="10" rx="2" />
        }
        @case ('calendar') {
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M16 3v4M8 3v4M3 11h18M8 16l2 2 4-4" />
        }
        @case ('chevron-down') {
          <path d="m6 9 6 6 6-6" />
        }
        @case ('chevron-left') {
          <path d="m15 6-6 6 6 6" />
        }
        @case ('chevron-right') {
          <path d="m9 6 6 6-6 6" />
        }
        @case ('brain') {
          <path
            d="M12 5a3 3 0 0 0-5.8-1A4 4 0 0 0 3 10a4 4 0 0 0 1 7.5A4 4 0 0 0 12 19V5Zm0 0a3 3 0 0 1 5.8-1A4 4 0 0 1 21 10a4 4 0 0 1-1 7.5A4 4 0 0 1 12 19"
          />
          <path d="M7 8a3 3 0 0 1 1 5M5 17a3 3 0 0 0 3-3M17 8a3 3 0 0 0-1 5M19 17a3 3 0 0 1-3-3" />
        }
        @case ('languages') {
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <path d="m5 16 3-8 3 8M6 13h4M19 10a3 3 0 1 0 0 5" />
        }
        @case ('bulb') {
          <path d="M9 18h6M9 21h6M8.5 15.5a7 7 0 1 1 7 0L15 18H9l-.5-2.5ZM12 17v-5m-2-2 2 2 2-2" />
        }
        @case ('check-circle') {
          <circle cx="12" cy="12" r="9" />
          <path d="m7.5 12 3 3 6-6" />
        }
        @case ('more-vertical') {
          <circle cx="12" cy="5" r="1" />
          <circle cx="12" cy="12" r="1" />
          <circle cx="12" cy="19" r="1" />
        }
        @case ('play') {
          <path d="m7 3 14 9-14 9z" />
        }
        @case ('wave') {
          <path d="M3 12c2.5-4.5 5.5-4.5 8 0s5.5 4.5 8 0" />
        }
        @case ('star') {
          <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.9z" />
        }
      }
    </svg>
  `,
})
export class Icon {
  readonly name = input.required<IconName>();
  readonly size = input(20);
}
