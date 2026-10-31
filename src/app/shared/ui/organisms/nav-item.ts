import { IconName } from '../atoms/icon/icon';

export interface NavItem {
  readonly label: string;
  readonly path: string;
  readonly icon: IconName;
}
