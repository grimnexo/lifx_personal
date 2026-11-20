import type { ReactNode } from 'react';

export function MiniCard({
  name,
  sub,
  color,
  grip,
  dragging,
}: {
  name: string;
  sub: string;
  color: string;
  grip: (cls: string, label: string) => ReactNode;
  dragging: boolean;
}) {
  const on = color.startsWith('#');
  return (
    <article
      className={`flex items-center gap-3 rounded-2xl border border-t-[5px] border-line bg-card px-4 py-3 ${dragging ? 'ring-2 ring-acc' : ''}`}
      style={{ borderTopColor: color, boxShadow: on ? `0 -8px 28px -14px ${color}` : undefined }}
    >
      {grip('flex h-[34px] w-7 flex-none cursor-grab items-center justify-center rounded-md before:h-5 before:w-[3px] before:border-x-[3px] before:border-solid before:border-mut before:content-[\'\'] hover:before:border-acc', name)}
      <div className="min-w-0">
        <h3 className="truncate font-semibold">{name}</h3>
        <p className="m-0 text-[.85rem] tabular-nums text-mut">{sub}</p>
      </div>
    </article>
  );
}
