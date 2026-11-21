import type { IconChoice } from '../branding';
import { Icon } from './icons';

export function BrandTile({ icon, customIcon }: { icon: IconChoice; customIcon?: string | null }) {
  if (icon === 'custom' && customIcon) {
    return <img src={customIcon} alt="" aria-hidden="true" className="size-7 flex-none rounded-lg object-cover" />;
  }
  const name = icon === 'custom' ? 'bulb' : icon;
  return (
    <span aria-hidden="true" className="grid size-7 flex-none place-items-center rounded-lg bg-acc text-on-acc">
      <Icon name={name} className="size-4" />
    </span>
  );
}
