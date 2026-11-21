import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';

const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acc';
const base =
  'inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border font-medium shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50';

export const btn = `${base} ${focusRing} border-line bg-card px-3.5 py-2 text-[.9rem] text-ink hover:border-acc hover:text-acc`;
export const btnPrimary = `${base} ${focusRing} border-acc bg-acc px-3.5 py-2 text-[.9rem] font-semibold text-on-acc hover:brightness-110`;
export const btnDanger = `${base} ${focusRing} border-danger bg-danger px-3.5 py-2 text-[.9rem] font-semibold text-white hover:brightness-110`;
export const btnSmall = `${base} ${focusRing} border-line bg-card px-2.5 py-1 text-[.8rem] text-ink hover:border-acc hover:text-acc`;
export const input =
  'w-full rounded-lg border border-line bg-bg px-3 py-2 text-ink placeholder:text-mut focus-visible:outline-2 focus-visible:outline-acc';
export const card = 'grid gap-2.5 rounded-[var(--radius)] border border-line bg-card p-4 shadow-card';
export const titleBtn =
  'min-w-0 cursor-pointer whitespace-normal break-words border-0 bg-transparent p-0 text-left text-ink hover:underline';
export const lnk = 'cursor-pointer border-0 bg-transparent p-0 text-[.8rem] text-mut hover:text-ink';
export const labelRow = 'flex justify-between gap-2 text-[.85rem] text-mut';
export const stLine = 'text-[.85rem] tabular-nums text-mut';
export const seg = (on: boolean) =>
  `flex-1 cursor-pointer border-0 px-1 py-1 ${on ? 'bg-acc text-bg' : 'bg-transparent text-ink'}`;
export const grid = 'grid items-start gap-4 grid-cols-[repeat(auto-fill,minmax(min(100%,320px),1fr))]';
export const kelvin = 'kelvin w-full';

export function Switch({
  checked,
  onChange,
  label,
  small,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  small?: boolean;
}) {
  return (
    <span className={`relative inline-block flex-none ${small ? 'h-5 w-[34px]' : 'h-7 w-12'}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={label}
        className="peer absolute inset-0 z-10 m-0 cursor-pointer opacity-0"
      />
      <i
        className={`absolute inset-0 rounded-full bg-line transition-colors peer-checked:bg-acc peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-acc after:absolute after:top-[3px] after:left-[3px] after:rounded-full after:bg-white after:transition-transform after:content-[''] ${
          small
            ? 'after:h-3.5 after:w-3.5 peer-checked:after:translate-x-[14px]'
            : 'after:h-[22px] after:w-[22px] peer-checked:after:translate-x-5'
        }`}
      />
    </span>
  );
}

export function Modal({
  open,
  onClose,
  labelledBy,
  className = '',
  children,
}: {
  open: boolean;
  onClose: () => void;
  labelledBy?: string;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    else if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby={labelledBy}
      className={`m-auto max-h-[90vh] w-[min(620px,94vw)] overflow-y-auto rounded-2xl border border-line bg-card p-[22px] text-ink backdrop:bg-black/50 ${className}`}
    >
      {open ? children : null}
    </dialog>
  );
}

export function Fieldset({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    <fieldset className="mb-3.5 grid gap-2 rounded-xl border border-line p-3">
      <legend className="px-1.5 font-semibold">{legend}</legend>
      {children}
    </fieldset>
  );
}

export function PageTitle({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-[1.9rem] leading-tight font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="m-0 mt-1 text-mut">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </header>
  );
}

const badgeTones = {
  ok: 'bg-ok/15 text-ok',
  warn: 'bg-warn/15 text-warn',
  danger: 'bg-danger/15 text-danger',
  off: 'bg-soft text-mut',
} as const;

export function Badge({ tone, children }: { tone: keyof typeof badgeTones; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[.8rem] font-medium ${badgeTones[tone]}`}>
      <i className="size-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}

export function Alert({
  title,
  tone = 'danger',
  onDismiss,
  children,
}: {
  title?: string;
  tone?: 'danger' | 'info' | 'ok';
  onDismiss?: () => void;
  children: ReactNode;
}) {
  const palette = {
    danger: 'border-danger/40 bg-danger/10 text-danger',
    info: 'border-acc/40 bg-acc/10 text-acc',
    ok: 'border-ok/40 bg-ok/10 text-ok',
  }[tone];
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={`flex items-start justify-between gap-3 rounded-[var(--radius)] border px-4 py-3 text-[.9rem] leading-snug ${palette}`}>
      <div className="min-w-0 text-ink">
        {title && <strong className={`mb-0.5 block text-base ${palette.split(' ').at(-1)}`}>{title}</strong>}
        {children}
      </div>
      {onDismiss && (
        <button
          aria-label="Dismiss"
          className="flex-none cursor-pointer rounded-md border-0 bg-transparent px-1.5 text-2xl leading-none text-mut hover:bg-soft"
          onClick={onDismiss}
        >
          &times;
        </button>
      )}
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5 text-[.9rem] font-medium">
      {label}
      {children}
      {hint && <small className="font-normal text-mut">{hint}</small>}
    </label>
  );
}

export type Grip = (cls: string, label: string) => ReactNode;

export function arrayMove<T>(arr: T[], from: number, to: number): T[] {
  const next = arr.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

// Pointer drag (and arrow keys) to reorder. Items are wrapped in display:contents so the parent grid still lays them out.
export function Sortable({
  ids,
  onCommit,
  className,
  children,
}: {
  ids: string[];
  onCommit: (ids: string[]) => void;
  className?: string;
  children: (id: string, grip: (cls: string, label: string) => ReactNode, dragging: boolean) => ReactNode;
}) {
  const [live, setLive] = useState<string[] | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const liveRef = useRef<string[] | null>(null);
  const focusId = useRef<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const shown = live ?? ids;

  useEffect(() => {
    const id = focusId.current;
    if (!id) return;
    focusId.current = null;
    containerRef.current?.querySelector<HTMLElement>(`[data-sort-id="${CSS.escape(id)}"] [data-grip]`)?.focus();
  }, [ids]);

  const startDrag = (id: string, e: PointerEvent) => {
    if (e.button > 0) return;
    e.preventDefault();
    liveRef.current = shown;
    setActive(id);
    setLive(shown);
    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';
    const move = (ev: globalThis.PointerEvent) => {
      const over = document
        .elementFromPoint(ev.clientX, ev.clientY)
        ?.closest<HTMLElement>('[data-sort-id]')?.dataset.sortId;
      const cur = liveRef.current;
      if (!cur || !over || over === id || !cur.includes(over)) return;
      const next = arrayMove(cur, cur.indexOf(id), cur.indexOf(over));
      liveRef.current = next;
      setLive(next);
    };
    const end = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      const fin = liveRef.current;
      liveRef.current = null;
      setActive(null);
      setLive(null);
      if (fin && fin.join('\n') !== ids.join('\n')) onCommit(fin);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  };

  const onKey = (id: string, e: KeyboardEvent) => {
    const step = /Up|Left/.test(e.key) ? -1 : /Down|Right/.test(e.key) ? 1 : 0;
    if (!step) return;
    e.preventDefault();
    const i = shown.indexOf(id);
    const j = i + step;
    if (j < 0 || j >= shown.length) return;
    focusId.current = id;
    onCommit(arrayMove(shown, i, j));
  };

  return (
    <div ref={containerRef} className={className}>
      {shown.map((id) => (
        <div key={id} data-sort-id={id} className="contents">
          {children(
            id,
            (cls, label) => (
              <span
                role="button"
                tabIndex={0}
                data-grip
                title="Drag to reorder"
                aria-label={`Reorder ${label} (arrow keys to move)`}
                className={`touch-none ${cls}`}
                onPointerDown={(e) => startDrag(id, e)}
                onKeyDown={(e) => onKey(id, e)}
              />
            ),
            active === id,
          )}
        </div>
      ))}
    </div>
  );
}
