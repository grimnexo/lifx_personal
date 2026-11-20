import type { AppIcon } from '../branding';
import { Icon } from './icons';

export function BrandTile({ icon }: { icon: AppIcon }) {
  return (
    <span aria-hidden="true" className="grid size-7 flex-none place-items-center rounded-lg bg-acc text-on-acc">
      <Icon name={icon} className="size-4" />
    </span>
  );
}
